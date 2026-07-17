#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function runCmd(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString().trim();
    } catch (e) {
        return null;
    }
}

function getQuietestHour() {
    try {
        // Parse git log to find the hour with the least commits
        const dates = runCmd('git log --format=%aI');
        if (!dates) return 3; // fallback 3 AM

        const hourCounts = new Array(24).fill(0);
        const lines = dates.split('\n');

        for (const line of lines) {
            if (!line) continue;
            // Example format: 2025-01-01T12:34:56-07:00
            const match = line.match(/T(\d{2}):/);
            if (match) {
                const hour = parseInt(match[1], 10);
                hourCounts[hour]++;
            }
        }

        // Find min count
        let minHour = 3;
        let minCount = Infinity;
        for (let i = 0; i < 24; i++) {
            if (hourCounts[i] < minCount) {
                minCount = hourCounts[i];
                minHour = i;
            }
        }
        return minHour;
    } catch (e) {
        return 3; // fallback 3 AM
    }
}

function computeSchedule() {
    console.log('Gathering telemetry...');

    const hasGh = runCmd('which gh') !== null;
    const quietHour = getQuietestHour();

    let newCron = `0 ${quietHour} * * 1`; // Default infrequent
    let rationale = 'Default infrequent schedule based on git history';

    if (hasGh) {
        try {
            const prs = runCmd('gh pr list --state merged --json mergedAt --limit 100') || '[]';
            const prCount = JSON.parse(prs).length;

            if (prCount > 50) {
                newCron = `0 */6 * * *`;
                rationale = `High PR velocity, running every 6 hours`;
            } else if (prCount > 20) {
                newCron = `0 ${quietHour} * * *`;
                rationale = `Active PR velocity, running daily at quiet hour (${quietHour}:00)`;
            } else if (prCount > 5) {
                newCron = `0 ${quietHour} * * 1,4`;
                rationale = `Standard PR velocity, running twice a week at quiet hour (${quietHour}:00)`;
            }
        } catch (e) {
            console.log('Error fetching PR stats, using fallback based on git history.');
        }
    } else {
        console.log('GitHub CLI (gh) not found, using fallback based on git history.');
    }

    return { newCron, rationale };
}

function main() {
    console.log('Computing new schedule...');
    const { newCron, rationale } = computeSchedule();

    let currentMetadata = {};
    if (fs.existsSync(SCHEDULE_FILE)) {
        try {
            currentMetadata = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || {};
        } catch (e) {
            console.error('Error reading current schedule metadata:', e);
        }
    }

    const lastUpdatedStr = currentMetadata.last_updated;
    if (lastUpdatedStr) {
        const lastUpdated = new Date(lastUpdatedStr);
        const now = new Date();
        const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
        if (diffHours < 72 && currentMetadata.schedule === newCron) {
            console.log('Schedule unchanged and updated recently. Exiting.');
            process.exit(0);
        }
    }

    const newMetadata = {
        schedule: newCron,
        rationale: rationale,
        last_updated: new Date().toISOString()
    };
    fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newMetadata));
    console.log(`Updated ${SCHEDULE_FILE} with new schedule: ${newCron}`);

    if (fs.existsSync(WORKFLOW_FILE)) {
        let workflowStr = fs.readFileSync(WORKFLOW_FILE, 'utf8');
        try {
            const workflowObj = yaml.load(workflowStr);
            let needsUpdate = false;

            if (workflowObj && workflowObj.on && Array.isArray(workflowObj.on.schedule)) {
                for (let i = 0; i < workflowObj.on.schedule.length; i++) {
                    const s = workflowObj.on.schedule[i];
                    if (s.cron !== newCron) {
                        workflowObj.on.schedule[i].cron = newCron;
                        needsUpdate = true;
                    }
                }
            } else if (workflowObj && workflowObj.on && workflowObj.on.schedule && workflowObj.on.schedule.cron !== newCron) {
                workflowObj.on.schedule.cron = newCron;
                needsUpdate = true;
            } else if (workflowObj && workflowObj.on && !workflowObj.on.schedule) {
                workflowObj.on.schedule = [{ cron: newCron }];
                needsUpdate = true;
            }

            if (needsUpdate) {
                const dumped = yaml.dump(workflowObj, { lineWidth: -1 });
                // Use alternative delimiter | to prevent regex collisions with * or / in cron
                const finalStr = dumped.replace(/cron: (['"]?)(.*?)\1/g, `cron: '$2' # AUTO-UPDATED`);

                yaml.load(finalStr);

                fs.writeFileSync(WORKFLOW_FILE, finalStr);
                console.log(`Updated schedule in ${WORKFLOW_FILE}`);
            } else {
                console.log(`Schedule in ${WORKFLOW_FILE} is already up to date.`);
            }
        } catch (e) {
            console.error('Error updating workflow file:', e);
            process.exit(1);
        }
    } else {
        console.warn(`Workflow file ${WORKFLOW_FILE} not found.`);
    }
}

main();

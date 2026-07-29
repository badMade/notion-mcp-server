#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const SCHEDULE_FILE = resolve(ROOT_DIR, '.github/self-heal-schedule.yml');

// Helper to run command and get stdout
function execCmd(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return '';
    }
}

// Compute the schedule based on commit telemetry
function computeSchedule() {
    console.log('Gathering telemetry...');

    // Look back at the last 30 days of commits
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    // Count commits in the last 30 days
    const commitLog = execCmd(`git log --since="${sinceDate}" --format=%aI`);
    const commitCount = commitLog ? commitLog.split('\n').filter(Boolean).length : 0;

    console.log(`Commits in last 30 days: ${commitCount}`);

    // Determine tier based on velocity
    let schedule = '0 0 * * 0'; // Default: weekly on Sunday (Dormant/Rare)
    let rationale = 'Dormant velocity: 1 run per week';

    if (commitCount > 50) {
        schedule = '0 */4 * * *'; // High: Every 4 hours
        rationale = `High velocity (${commitCount} commits/mo): Run every 4 hours`;
    } else if (commitCount > 20) {
        schedule = '0 2,14 * * *'; // Active: Twice daily
        rationale = `Active velocity (${commitCount} commits/mo): Run twice daily`;
    } else if (commitCount > 5) {
        schedule = '0 2 * * *'; // Standard: Daily
        rationale = `Standard velocity (${commitCount} commits/mo): Run daily`;
    } else if (commitCount > 0) {
        schedule = '0 2 * * 1,4'; // Low-churn: Twice a week
        rationale = `Low-churn velocity (${commitCount} commits/mo): Run twice weekly`;
    }

    return { schedule, rationale };
}

async function main() {
    console.log('Computing new schedule...');

    // Ensure schedule file exists or create a default structure
    let currentConfig = {};
    let scheduleUpdatedTime = 0;

    if (fs.existsSync(SCHEDULE_FILE)) {
        try {
            const fileContent = fs.readFileSync(SCHEDULE_FILE, 'utf8');
            currentConfig = yaml.load(fileContent) || {};
            scheduleUpdatedTime = currentConfig.LAST_UPDATED ? new Date(currentConfig.LAST_UPDATED).getTime() : 0;
        } catch (e) {
            console.error('Error reading current schedule file. Will recreate.', e);
        }
    }

    // Oscillation guard: skip if updated in the last 3 days (3 * 24 * 60 * 60 * 1000 ms)
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - scheduleUpdatedTime < threeDaysMs) {
        console.log('Schedule updated recently (within 3 days). Skipping recomputation.');
        process.exit(1); // Non-zero indicates no change needed
    }

    const { schedule, rationale } = computeSchedule();

    // Check if changed
    if (currentConfig.SELFHEAL_SCHEDULE === schedule) {
        console.log('Schedule unchanged. No update required.');
        process.exit(1);
    }

    console.log(`New Schedule: ${schedule}`);
    console.log(`Rationale: ${rationale}`);

    // Update config safely via js-yaml
    const newConfig = {
        ...currentConfig,
        SELFHEAL_SCHEDULE: schedule,
        RATIONALE: rationale,
        LAST_UPDATED: new Date().toISOString()
    };

    // Add the # AUTO-UPDATED marker via string replacement after dump
    let yamlString = yaml.dump(newConfig, { forceQuotes: true });

    // Fallback marker replacement (append a comment if it helps safe sed later)
    yamlString = yamlString.replace(/SELFHEAL_SCHEDULE:(.*)/, "SELFHEAL_SCHEDULE:$1 # AUTO-UPDATED");

    // Ensure directory exists
    fs.mkdirSync(dirname(SCHEDULE_FILE), { recursive: true });
    fs.writeFileSync(SCHEDULE_FILE, yamlString, 'utf8');

    console.log(`Updated ${SCHEDULE_FILE}`);

    // Validate parseability
    try {
        yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
        console.log('YAML output validated successfully.');
    } catch (e) {
        console.error('Validation failed. Restoring original config...', e);
        if (currentConfig.SELFHEAL_SCHEDULE) {
            fs.writeFileSync(SCHEDULE_FILE, yaml.dump(currentConfig, { forceQuotes: true }), 'utf8');
        }
        process.exit(1);
    }

    // Exit 0 to indicate a successful update that needs a PR
    process.exit(0);
}

main().catch(error => {
    console.error('Unhandled error during schedule computation:', error);
    process.exit(1);
});

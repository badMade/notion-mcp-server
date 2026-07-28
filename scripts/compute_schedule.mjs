#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

function run(command, silent = true) {
  try {
    const output = execSync(command, { stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: output ? output.toString() : '' };
  } catch (err) {
    if (!silent) console.error(`Error running command: ${command}`);
    return { success: false, output: err.stdout ? err.stdout.toString() : '' };
  }
}

const SCHEDULE_METADATA_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function getTelemetry() {
    // Basic telemetry via git log since gh api needs auth which might not work locally
    // but in CI gh cli is typically authenticated via GITHUB_TOKEN

    // PR merge frequency
    let merges = 0;
    const mergeCmd = run("gh pr list --state merged --json mergedAt", true);
    if (mergeCmd.success) {
        try {
            merges = JSON.parse(mergeCmd.output).length;
        } catch (e) {}
    }

    // Commits last 30 days
    let commits = 0;
    const commitCmd = run('git log --since="30 days ago" --oneline', true);
    if (commitCmd.success) {
        commits = commitCmd.output.split('\n').filter(Boolean).length;
    }

    // Active hours
    const hours = run('git log --format=%aI', true);
    let bestHour = '0';
    if (hours.success) {
        const hourCounts = {};
        const lines = hours.output.trim().split('\n');
        for (const line of lines) {
            if (!line) continue;
            // e.g. 2023-10-25T14:32:01+00:00
            const match = line.match(/T(\d{2}):/);
            if (match) {
                const hour = match[1];
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        }

        // Find most active hour
        let maxCount = -1;
        for (const [h, count] of Object.entries(hourCounts)) {
            if (count > maxCount) {
                maxCount = count;
                bestHour = h;
            }
        }
    }

    // Find quietest window by inverting bestHour (rough heuristic)
    // We schedule 1 hour before the most active hour so it's ready
    let scheduleHour = parseInt(bestHour, 10) - 1;
    if (scheduleHour < 0) scheduleHour = 23;

    return { commits, merges, scheduleHour };
}

function computeSchedule(telemetry) {
    // Tiers
    // High: commits > 50 -> 0 * * * * (every hour) - maybe too much, let's do every 4 hours
    // Active: commits > 20 -> 0 */6 * * *
    // Standard: commits > 5 -> 0 0 * * * (daily)
    // Low: commits > 0 -> 0 0 * * 0 (weekly)
    // Dormant: 0 0 1 * * (monthly)

    const { commits, scheduleHour } = telemetry;
    let cron = `0 ${scheduleHour} * * *`;
    let rationale = "Standard daily run";

    if (commits > 50) {
        cron = `0 */4 * * *`;
        rationale = "High PR velocity: every 4 hours";
    } else if (commits > 20) {
        cron = `0 */6 * * *`;
        rationale = "Active PR velocity: every 6 hours";
    } else if (commits > 5) {
        cron = `0 ${scheduleHour} * * *`;
        rationale = `Standard PR velocity: daily at ${scheduleHour}:00`;
    } else if (commits > 0) {
        cron = `0 ${scheduleHour} * * 0`;
        rationale = `Low PR velocity: weekly on Sunday at ${scheduleHour}:00`;
    } else {
        cron = `0 0 1 * *`;
        rationale = "Dormant: monthly on the 1st";
    }

    return { cron, rationale };
}

function main() {
    console.log("Computing schedule...");

    // Oscillation guard
    if (fs.existsSync(SCHEDULE_METADATA_FILE)) {
        const currentData = yaml.load(fs.readFileSync(SCHEDULE_METADATA_FILE, 'utf8'));
        if (currentData && currentData.last_updated) {
            const lastUpdated = new Date(currentData.last_updated);
            const now = new Date();
            const diffDays = (now - lastUpdated) / (1000 * 60 * 60 * 24);
            if (diffDays < 1) {
                console.log("Schedule updated within the last day. Skipping recompute to avoid thrashing.");
                process.exit(0);
            }
        }
    }

    const telemetry = getTelemetry();
    const newSchedule = computeSchedule(telemetry);

    console.log(`Computed new schedule: ${newSchedule.cron}`);
    console.log(`Rationale: ${newSchedule.rationale}`);

    let currentCron = "";
    if (fs.existsSync(SCHEDULE_METADATA_FILE)) {
        const currentData = yaml.load(fs.readFileSync(SCHEDULE_METADATA_FILE, 'utf8'));
        currentCron = currentData.schedule;
    }

    if (currentCron === newSchedule.cron) {
        console.log("Schedule unchanged. Exiting.");
        process.exit(0);
    }

    // Update metadata file
    const newMetadata = {
        schedule: newSchedule.cron,
        rationale: newSchedule.rationale,
        last_updated: new Date().toISOString()
    };

    fs.writeFileSync(SCHEDULE_METADATA_FILE, yaml.dump(newMetadata));
    console.log(`Updated ${SCHEDULE_METADATA_FILE}`);

    // Update workflow file
    if (fs.existsSync(WORKFLOW_FILE)) {
        let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
        // Replace using the anchor '# AUTO-UPDATED'
        workflowContent = workflowContent.replace(/cron: ["'].+["']\s*# AUTO-UPDATED/g, `cron: "${newSchedule.cron}" # AUTO-UPDATED`);
        fs.writeFileSync(WORKFLOW_FILE, workflowContent);
        console.log(`Updated ${WORKFLOW_FILE}`);
    } else {
        console.log(`${WORKFLOW_FILE} not found. Skipping workflow update.`);
    }

    // Output variables for github actions
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=true\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule=${newSchedule.cron}\n`);
    }
}

main();

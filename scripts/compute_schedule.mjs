#!/usr/bin/env node

/**
 * Compute Schedule script for the self-healing CI pipeline.
 * Computes an optimal schedule expression based on telemetry.
 * Safe YAML round-trip via js-yaml with forceQuotes: true.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const SCHEDULE_FILE_PATH = resolve(rootDir, '.github/self-heal-schedule.yml');
const WORKFLOW_FILE_PATH = resolve(rootDir, '.github/workflows/self-heal.yml');

// Helper to calculate days between two dates
function daysBetween(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 1. Check Oscillation Guard
let currentScheduleConfig = null;
try {
    const fileContents = fs.readFileSync(SCHEDULE_FILE_PATH, 'utf8');
    currentScheduleConfig = yaml.load(fileContents);

    if (currentScheduleConfig && currentScheduleConfig.last_updated) {
        const lastUpdatedDate = new Date(currentScheduleConfig.last_updated);
        const daysSinceLastUpdate = daysBetween(new Date(), lastUpdatedDate);
        if (daysSinceLastUpdate < 3) {
            console.log('Oscillation guard triggered. Schedule updated less than 3 days ago. Skipping.');
            process.exit(0);
        }
    }
} catch (e) {
    console.log('Error reading existing schedule file or none exists:', e.message);
}

// 2. Telemetry Gathering (simplified for node environment constraints)
// In a real environment, this would call `gh pr list --state merged --json mergedAt`
// and `git log --format=%aI` over a lookback window.
let commitCountLast30Days = 0;
try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateString = thirtyDaysAgo.toISOString().split('T')[0];
    const commits = execSync(`git log --since="${dateString}" --oneline | wc -l`, { cwd: rootDir, encoding: 'utf-8' });
    commitCountLast30Days = parseInt(commits.trim(), 10) || 0;
} catch (e) {
    console.log('Could not determine git log telemetry. Falling back to default.');
}

console.log(`Telemetry: Found ${commitCountLast30Days} commits in the last 30 days.`);

// 3. Cadence Tier Logic
let newCron = "0 0 * * *"; // Default daily
let newRationale = "Default daily schedule.";

if (commitCountLast30Days > 50) {
    newCron = "0 */12 * * *"; // High: Twice daily
    newRationale = "High PR velocity (>50 commits/mo). Scheduling twice daily.";
} else if (commitCountLast30Days > 10) {
    newCron = "0 0 * * *"; // Active: Daily
    newRationale = "Active PR velocity (10-50 commits/mo). Scheduling daily.";
} else if (commitCountLast30Days > 0) {
    newCron = "0 0 * * 0"; // Low/Standard: Weekly
    newRationale = "Low PR velocity (1-10 commits/mo). Scheduling weekly.";
} else {
    newCron = "0 0 1 * *"; // Dormant: Monthly
    newRationale = "Dormant PR velocity (0 commits/mo). Scheduling monthly.";
}

console.log(`Computed new schedule: ${newCron}`);
console.log(`Rationale: ${newRationale}`);

if (currentScheduleConfig && currentScheduleConfig.schedule === newCron) {
    console.log('Computed schedule is exactly the same as the current schedule. Exiting 0.');
    process.exit(0);
}

// 4. Update the YAML files
const nowStr = new Date().toISOString();
const newScheduleConfig = {
    schedule: newCron,
    rationale: newRationale,
    last_updated: nowStr
};

// Write to .github/self-heal-schedule.yml (Safe YAML round-trip)
const dumpedSchedule = yaml.dump(newScheduleConfig, { forceQuotes: true });
fs.writeFileSync(SCHEDULE_FILE_PATH, dumpedSchedule);
console.log(`Updated ${SCHEDULE_FILE_PATH}`);

// Update .github/workflows/self-heal.yml using string replacement anchored by `# AUTO-UPDATED`
try {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE_PATH, 'utf8');
    // Replace the line containing `# AUTO-UPDATED`
    const regex = /^(\s*- cron:\s*).*(\s*# AUTO-UPDATED.*)$/m;
    if (regex.test(workflowContent)) {
        workflowContent = workflowContent.replace(regex, `$1"${newCron}"$2`);
        fs.writeFileSync(WORKFLOW_FILE_PATH, workflowContent);
        console.log(`Updated ${WORKFLOW_FILE_PATH}`);
    } else {
        console.error('Could not find # AUTO-UPDATED marker in self-heal.yml.');
        process.exit(1);
    }
} catch (e) {
    console.error('Failed to update self-heal.yml:', e.message);
    process.exit(1);
}

console.log('Schedule update complete.');
process.exit(0);

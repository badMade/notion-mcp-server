#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';

const SCHEDULE_CONFIG_PATH = '.github/self-heal-schedule.yml';

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    return null;
  }
}

// Ensure GH token is present for telemetry
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.warn("GH_TOKEN is missing. This may cause telemetry API calls to fail if the repository is private or heavily rate-limited.");
}

console.log('Gathering telemetry...');

// PR merge frequency (count merged PRs in last 30 days)
let recentPRsCount = 0;
const date30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
try {
  const prs = runCmd(`gh pr list --state merged --search "merged:>=${date30DaysAgo}" --json mergedAt`);
  if (prs) recentPRsCount = JSON.parse(prs).length;
} catch (e) {
  console.warn("Could not query PRs via gh cli, defaulting to 0");
}

// Determine active period using git logs (mode of inactivity simplification)
// We'll compute the most common hour of commits to align the schedule
const commitHours = runCmd("git log --format='%aI' -n 100") || '';
const hoursMap = {};
commitHours.split('\n').filter(Boolean).forEach(dateStr => {
  const date = new Date(dateStr);
  if (!isNaN(date.getHours())) {
    const hr = date.getUTCHours();
    hoursMap[hr] = (hoursMap[hr] || 0) + 1;
  }
});

let mostActiveHour = 0;
let maxCommits = -1;
Object.entries(hoursMap).forEach(([hr, count]) => {
  if (count > maxCommits) {
    maxCommits = count;
    mostActiveHour = parseInt(hr, 10);
  }
});

// Calculate cadence tier
let cron = '';
let tier = '';
let rationale = '';

// Schedule runs *before* the active window begins (offset by -2 hours)
let scheduledHour = (mostActiveHour - 2 + 24) % 24;

if (recentPRsCount > 20) {
  tier = 'high';
  cron = `0 */6 * * *`;
  rationale = `High PR velocity (${recentPRsCount} merged in 30 days). Multiple runs daily.`;
} else if (recentPRsCount > 10) {
  tier = 'active';
  cron = `0 */12 * * *`;
  rationale = `Active PR velocity (${recentPRsCount} merged in 30 days). Runs twice daily.`;
} else if (recentPRsCount > 3) {
  tier = 'standard';
  cron = `0 ${scheduledHour} * * *`;
  rationale = `Standard PR velocity (${recentPRsCount} merged in 30 days). Runs once daily before active hour.`;
} else if (recentPRsCount > 0) {
  tier = 'low-churn';
  cron = `0 ${scheduledHour} * * 1,4`;
  rationale = `Low PR velocity (${recentPRsCount} merged in 30 days). Runs twice weekly.`;
} else {
  tier = 'dormant';
  cron = `0 ${scheduledHour} * * 1`;
  rationale = `Dormant PR velocity. Runs once weekly.`;
}

console.log(`Computed tier: ${tier}`);
console.log(`Computed cron: ${cron}`);
console.log(`Rationale: ${rationale}`);

// Oscillation check
let lastUpdatedStr = null;
try {
  if (runCmd(`test -f ${SCHEDULE_CONFIG_PATH} && echo "exists"`)) {
      const existingConfigStr = readFileSync(SCHEDULE_CONFIG_PATH, 'utf8');
      const existingConfig = yaml.load(existingConfigStr);
      lastUpdatedStr = existingConfig.last_updated;
      if (existingConfig.cron === cron) {
        console.log("Computed cron matches existing cron. No update needed.");
        process.exit(0); // Exit cleanly
      }
  }
} catch (e) {
  console.log("Could not read previous schedule config (maybe first run).");
}

if (lastUpdatedStr) {
  const lastUpdated = new Date(lastUpdatedStr);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 3) {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago. Skipping to prevent oscillation.`);
    process.exit(0);
  }
}

const configPayload = {
  cron: cron,
  tier: tier,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

const yamlStr = yaml.dump(configPayload);

writeFileSync(SCHEDULE_CONFIG_PATH, yamlStr);
console.log(`Updated ${SCHEDULE_CONFIG_PATH}`);

// Update github actions workflow file inline (using sed as fallback/standard approach as described)
const WORKFLOW_PATH = '.github/workflows/self-heal.yml';
if (runCmd(`test -f ${WORKFLOW_PATH} && echo "exists"`)) {
   runCmd(`sed -i -E "s|cron: '.*' # AUTO-UPDATED|cron: '${cron}' # AUTO-UPDATED|" ${WORKFLOW_PATH}`);
   console.log(`Updated ${WORKFLOW_PATH} inline using sed.`);
} else {
  console.log(`Workflow ${WORKFLOW_PATH} not found. Ensure it is created.`);
}

console.log("Schedule computation complete.");

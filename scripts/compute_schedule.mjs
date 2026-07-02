#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function runGh(command) {
  try {
    return execSync(`gh ${command}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (e) {
    console.error(`GH command failed: gh ${command}`);
    return '';
  }
}

// Fallback telemetry defaults if git history or gh fail
let prCount = 0;
let successCount = 0;
let failureCount = 0;
let hourMode = 0;

try {
  // Try to get merged PRs in the last 14 days
  const mergedPrs = runGh(`pr list --state merged --json mergedAt`);
  if (mergedPrs) {
    const prs = JSON.parse(mergedPrs);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    prCount = prs.filter(pr => new Date(pr.mergedAt) > fourteenDaysAgo).length;
  }

  // Try to get self-heal PRs success
  const selfHealPrs = runGh(`pr list --label self-heal --state all --json state`);
  if (selfHealPrs) {
    const prs = JSON.parse(selfHealPrs);
    successCount = prs.filter(pr => pr.state === 'MERGED').length;
  }

  // Try to get CI failure rate
  const ciRuns = runGh(`run list --workflow=ci --json conclusion`);
  if (ciRuns) {
    const runs = JSON.parse(ciRuns);
    failureCount = runs.filter(run => run.conclusion === 'failure').length;
  }

  // Mode hour of inactivity
  const commitHours = execSync(`git log --format=%aI -n 100`, { encoding: 'utf-8' }).trim().split('\n');
  const counts = Array(24).fill(0);
  for (const dateStr of commitHours) {
    if (dateStr) {
      const hour = new Date(dateStr).getHours();
      if (!isNaN(hour)) counts[hour]++;
    }
  }
  // Find least active hour
  let minHour = 0;
  let minCount = counts[0];
  for (let i = 1; i < 24; i++) {
    if (counts[i] < minCount) {
      minCount = counts[i];
      minHour = i;
    }
  }
  hourMode = minHour;

} catch (e) {
  console.log('Using default telemetry values due to error or missing history.');
  hourMode = 0;
}

// Compute Cadence
let scheduleExpression = `${hourMode} * * * *`;
let rationale = "Default frequency";

if (prCount > 10) {
  scheduleExpression = `0 */4 * * *`;
  rationale = "High PR velocity: 4-hour cadence";
} else if (prCount > 3) {
  scheduleExpression = `0 0,12 * * *`;
  rationale = "Active PR velocity: 12-hour cadence";
} else if (prCount > 0) {
  scheduleExpression = `0 ${hourMode} * * *`;
  rationale = "Standard PR velocity: daily cadence during quiet hour";
} else {
  scheduleExpression = `0 0 * * 0`;
  rationale = "Dormant PR velocity: weekly cadence";
}

// Adjust based on failures vs successes
if (failureCount > 5 || successCount > 3) {
  scheduleExpression = `0 */8 * * *`;
  rationale += " (Adjusted up due to high failure/success rate)";
}

console.log(`Computed Schedule: ${scheduleExpression}`);
console.log(`Rationale: ${rationale}`);

// Safe yaml update of .github/self-heal-schedule.yml
let scheduleData = {};
try {
  const content = readFileSync(SCHEDULE_FILE, 'utf-8');
  scheduleData = yaml.load(content) || {};
} catch (e) {
  // File might not exist yet
  scheduleData = {};
}

scheduleData.SELFHEAL_SCHEDULE = scheduleExpression;
scheduleData.rationale = rationale;
scheduleData.LAST_UPDATED = new Date().toISOString();

writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData));
console.log(`Updated ${SCHEDULE_FILE}`);

// Update .github/workflows/self-heal.yml
try {
  let wfContent = readFileSync(WORKFLOW_FILE, 'utf-8');
  // Safe replacement anchored by # AUTO-UPDATED marker
  const newCronLine = `    - cron: '${scheduleExpression}' # AUTO-UPDATED`;
  wfContent = wfContent.replace(/.*cron:.*# AUTO-UPDATED.*/, newCronLine);
  writeFileSync(WORKFLOW_FILE, wfContent);
  console.log(`Updated ${WORKFLOW_FILE}`);
} catch (e) {
  console.log('self-heal.yml not found or not updated yet.');
}

process.exit(0);

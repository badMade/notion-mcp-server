#!/usr/bin/env node

import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Safe wrapper for commands
function runSafe(command, fallback = '') {
  try {
    return cp.execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return fallback;
  }
}

console.log('Computing new schedule...');

// 1. Gather Telemetry
// Telemetry sources:
// - PR merge frequency
let prMergesStr = runSafe("gh pr list --state merged --json mergedAt -q '.[].mergedAt'", '');
let prMerges = prMergesStr.split('\n').filter(Boolean);

// - Commit frequency by hour-of-day
let commitHoursStr = runSafe("git log --format=%aI | head -n 50", '');
let commitDates = commitHoursStr.split('\n').filter(Boolean);

// Calculate PR velocity tier
let velocity = 'standard';
if (prMerges.length > 20) {
  velocity = 'high';
} else if (prMerges.length > 10) {
  velocity = 'active';
} else if (prMerges.length > 3) {
  velocity = 'standard';
} else if (prMerges.length > 0) {
  velocity = 'low-churn';
} else {
  velocity = 'dormant';
}

// 2. Active-period detection
let hourCounts = new Array(24).fill(0);
for (const dateStr of commitDates) {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    hourCounts[d.getUTCHours()]++;
  }
}

// Find quietest window (minimum commits)
let quietestHour = 0;
let minCommits = Infinity;
for (let i = 0; i < 24; i++) {
  if (hourCounts[i] < minCommits) {
    minCommits = hourCounts[i];
    quietestHour = i;
  }
}

// Schedule run immediately before quietest window begins
const scheduleHour = quietestHour;

// Compute frequency based on tier
let cronExpr = `0 ${scheduleHour} * * *`; // Daily
if (velocity === 'high') {
  cronExpr = `0 ${scheduleHour},${(scheduleHour + 12) % 24} * * *`; // Twice daily
} else if (velocity === 'dormant') {
  cronExpr = `0 ${scheduleHour} * * 1`; // Weekly on Monday
}

console.log(`Computed cadence tier: ${velocity}`);
console.log(`Computed schedule: ${cronExpr}`);

// 3. Read existing schedule file to check oscillation guard
const scheduleFile = '.github/self-heal-schedule.yml';
let lastUpdated = 0;
let currentSchedule = '';

if (fs.existsSync(scheduleFile)) {
  try {
    const content = fs.readFileSync(scheduleFile, 'utf8');
    const parsed = yaml.load(content);
    if (parsed && parsed.last_updated) {
      lastUpdated = new Date(parsed.last_updated).getTime();
    }
    if (parsed && parsed.schedule) {
      currentSchedule = parsed.schedule;
    }
  } catch (e) {
    console.warn('Failed to parse existing schedule file:', e.message);
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
if (Date.now() - lastUpdated < ONE_DAY_MS && cronExpr !== currentSchedule) {
  console.log('Oscillation guard: Schedule was updated less than 24 hours ago. Skipping update.');
  process.exit(0);
}

if (cronExpr === currentSchedule) {
  console.log('Schedule is unchanged. Exiting.');
  process.exit(0);
}

// 4. Update the schedule files
const newScheduleData = {
  schedule: cronExpr,
  rationale: `Computed automatically. Tier: ${velocity}, Active window starts ~${quietestHour}:00 UTC.`,
  last_updated: new Date().toISOString()
};

fs.writeFileSync(scheduleFile, yaml.dump(newScheduleData));
console.log(`Updated ${scheduleFile}`);

// Update self-heal.yml
const workflowFile = '.github/workflows/self-heal.yml';
if (fs.existsSync(workflowFile)) {
  let content = fs.readFileSync(workflowFile, 'utf8');
  // Safe replace anchoring on # AUTO-UPDATED
  content = content.replace(/cron:\s*['"]?[^'"\n]+['"]?\s*# AUTO-UPDATED/, `cron: '${cronExpr}' # AUTO-UPDATED`);
  fs.writeFileSync(workflowFile, content);

  // Validate that the output is parseable
  try {
    yaml.load(fs.readFileSync(workflowFile, 'utf8'));
    console.log(`Updated and validated ${workflowFile}`);
  } catch (e) {
    console.error('Validation failed after mutating self-heal.yml:', e.message);
    process.exit(1);
  }
}

console.log('Schedule computation complete.');

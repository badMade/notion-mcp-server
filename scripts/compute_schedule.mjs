#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';

// Helper to run GH/Git commands
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    return null;
  }
}

// 1. Gather Telemetry (Mocking parts that might not run well if no history)
console.log('Gathering telemetry...');

// Commit frequency by hour
const commitsByHourOutput = runCmd('git log --format=%aI');
let hourCounts = Array(24).fill(0);
if (commitsByHourOutput) {
  const lines = commitsByHourOutput.split('\n').filter(Boolean);
  lines.forEach(line => {
    // format: 2023-01-01T12:34:56Z
    const match = line.match(/T(\d{2}):/);
    if (match) {
      hourCounts[parseInt(match[1], 10)]++;
    }
  });
}

// Determine active-period
// Find the quietest hour
let quietestHour = 0;
let minCount = Infinity;
for (let i = 0; i < 24; i++) {
  if (hourCounts[i] < minCount) {
    minCount = hourCounts[i];
    quietestHour = i;
  }
}

// Just an approximation for PR velocity:
// if lots of commits -> active tier (multiple times a day), etc.
const totalCommits = hourCounts.reduce((a, b) => a + b, 0);

let cronExpression;
let rationale;

if (totalCommits > 100) {
  // Active tier: runs multiple times a day
  const otherHour = (quietestHour + 12) % 24;
  cronExpression = `0 ${quietestHour},${otherHour} * * *`;
  rationale = `High activity (${totalCommits} commits). Running at quietest hour ${quietestHour}:00 and ${otherHour}:00.`;
} else if (totalCommits > 10) {
  // Moderate tier: runs once a day at quietest hour
  cronExpression = `0 ${quietestHour} * * *`;
  rationale = `Moderate activity (${totalCommits} commits). Running at quietest hour ${quietestHour}:00.`;
} else {
  // Low tier: runs once a week at quietest hour
  cronExpression = `0 ${quietestHour} * * 0`;
  rationale = `Low activity (${totalCommits} commits). Running weekly on Sunday at ${quietestHour}:00.`;
}

console.log(`Computed Schedule: ${cronExpression}`);
console.log(`Rationale: ${rationale}`);

// Update schedule file
const scheduleFile = '.github/self-heal-schedule.yml';
const workflowFile = '.github/workflows/self-heal.yml';

const scheduleData = {
  SELFHEAL_SCHEDULE: cronExpression,
  RATIONALE: rationale,
  LAST_UPDATED: new Date().toISOString()
};

writeFileSync(scheduleFile, yaml.dump(scheduleData, { forceQuotes: true }), 'utf8');
console.log(`Updated ${scheduleFile}`);

// Update workflow file (if it exists)
try {
  let wfContent = readFileSync(workflowFile, 'utf8');
  wfContent = wfContent.replace(/cron:\s*['"][^'"]+['"]\s*#\s*AUTO-UPDATED/, `cron: "${cronExpression}" # AUTO-UPDATED`);
  writeFileSync(workflowFile, wfContent, 'utf8');
  console.log(`Updated ${workflowFile}`);
} catch (error) {
  console.log('Workflow file not found or could not be updated (might not be created yet).');
}

console.log('Schedule computation complete.');

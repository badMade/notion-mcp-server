#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const SCHEDULE_FILE = resolve(projectRoot, '.github/self-heal-schedule.yml');
const WORKFLOW_FILE = resolve(projectRoot, '.github/workflows/self-heal.yml');

// Get current schedule from file if it exists
let currentConfig = { schedule: '0 0 * * *', rationale: 'Fallback schedule', last_updated: 0 };
if (existsSync(SCHEDULE_FILE)) {
  try {
    currentConfig = yaml.load(readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch (e) {
    console.warn('Could not parse existing schedule file, using defaults.');
  }
}

// Telemetry
const getCommitCount = () => {
  try {
    // Number of commits in the last 7 days
    const stdout = execSync('git rev-list --count --since="7 days ago" HEAD', { cwd: projectRoot }).toString().trim();
    return parseInt(stdout, 10) || 0;
  } catch (e) {
    return 0;
  }
};

const commitCount = getCommitCount();
let newSchedule;
let rationale;

// Calculate tier based on commit velocity
if (commitCount > 50) {
  newSchedule = '0 */6 * * *'; // Every 6 hours
  rationale = 'High velocity (>50 commits/week) -> runs every 6 hours';
} else if (commitCount > 20) {
  newSchedule = '0 */12 * * *'; // Every 12 hours
  rationale = 'Active velocity (>20 commits/week) -> runs every 12 hours';
} else if (commitCount > 5) {
  newSchedule = '0 0 * * *'; // Daily
  rationale = 'Standard velocity (>5 commits/week) -> runs daily';
} else {
  newSchedule = '0 0 * * 0'; // Weekly on Sunday
  rationale = 'Low velocity (<=5 commits/week) -> runs weekly';
}

const now = Date.now();
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Oscillation guard
if (currentConfig.last_updated && (now - currentConfig.last_updated) < THREE_DAYS_MS) {
  console.log('Schedule updated recently (less than 3 days ago). Skipping update to prevent oscillation.');
  process.exit(0);
}

if (newSchedule === currentConfig.schedule) {
  console.log(`Schedule unchanged: ${newSchedule}. No updates needed.`);
  process.exit(0); // Exit 0 when no update needed (clean exit, no PR to open)
}

console.log(`Updating schedule to: ${newSchedule} (${rationale})`);

// Update schedule file
const updatedConfig = {
  schedule: newSchedule,
  rationale,
  last_updated: now
};
writeFileSync(SCHEDULE_FILE, yaml.dump(updatedConfig, { forceQuotes: true }), 'utf8');

// Update workflow file if it exists
if (existsSync(WORKFLOW_FILE)) {
  try {
    let content = readFileSync(WORKFLOW_FILE, 'utf8');
    // Regex matches the cron line with the inline marker
    content = content.replace(
      /cron:\s*['"][^'"]+['"]\s*#\s*AUTO-UPDATED/,
      `cron: "${newSchedule}" # AUTO-UPDATED`
    );
    writeFileSync(WORKFLOW_FILE, content, 'utf8');
    console.log('Successfully updated self-heal.yml workflow.');
  } catch (e) {
    console.error('Failed to update self-heal.yml workflow file:', e);
    process.exit(1);
  }
} else {
  console.warn('.github/workflows/self-heal.yml does not exist yet. Schedule computed anyway.');
}

console.log('Schedule update successful.');
// Exiting 0 to signal that changes were made, PR logic will check `git status --porcelain`
process.exit(0);

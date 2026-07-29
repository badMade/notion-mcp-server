#!/usr/bin/env node

/**
 * Self-healing Schedule Compute Script
 * Computes optimal cadence based on GH telemetry and updates schedules.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const runCommand = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
};

const main = () => {
  console.log('Computing new schedule...');
  let currentConfig = { schedule: '0 2 * * *', rationale: 'Fallback', LAST_UPDATED: 0 };

  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      currentConfig = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf-8')) || currentConfig;
    } catch (e) {
      console.warn('Could not parse existing schedule file. Using defaults.');
    }
  }

  const now = Date.now();
  if (now - currentConfig.LAST_UPDATED < THREE_DAYS_MS) {
    console.log('Oscillation guard: Schedule was updated less than 3 days ago. Skipping.');
    process.exit(0);
  }

  // Telemetry: Count commits in the last 30 days
  const commitsStr = runCommand('git log --since="30 days ago" --oneline | wc -l');
  const commitCount = commitsStr ? parseInt(commitsStr, 10) : 0;

  let newSchedule = '0 0 * * 0'; // Rare (weekly)
  let rationale = 'Low/Dormant activity (weekly)';

  if (commitCount > 50) {
    newSchedule = '0 */4 * * *'; // High (every 4 hours)
    rationale = 'High activity (>50 commits/mo)';
  } else if (commitCount > 20) {
    newSchedule = '0 */12 * * *'; // Frequent (twice daily)
    rationale = 'Active (20-50 commits/mo)';
  } else if (commitCount > 5) {
    newSchedule = '0 2 * * *'; // Standard (daily)
    rationale = 'Standard (5-20 commits/mo)';
  }

  if (newSchedule === currentConfig.schedule) {
    console.log(`Schedule is unchanged (${newSchedule}). No updates needed.`);
    process.exit(0);
  }

  console.log(`Updating schedule to: ${newSchedule}`);
  currentConfig.schedule = newSchedule;
  currentConfig.rationale = rationale;
  currentConfig.LAST_UPDATED = now;

  // Write safe YAML
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(currentConfig));

  // Update Workflow file via sed if it exists
  if (fs.existsSync(WORKFLOW_FILE)) {
    try {
      execSync(`sed -i "s|cron:.*# AUTO-UPDATED|cron: '${newSchedule}' # AUTO-UPDATED|" ${WORKFLOW_FILE}`);
      console.log('Updated workflow file schedule.');
    } catch (e) {
      console.error('Failed to update workflow file via sed.');
    }
  }

  process.exit(0);
};

main();

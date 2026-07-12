#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const SCHEDULE_FILE = resolve(rootDir, '.github/self-heal-schedule.yml');
const WORKFLOW_FILE = resolve(rootDir, '.github/workflows/self-heal.yml');

// Oscillation guard: Ensure at least 24 hours between updates
const MIN_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

function getCommitFrequencyByHour() {
  try {
    const output = execSync('git log --format=%aI -n 100', { cwd: rootDir, stdio: 'pipe' }).toString();
    const hours = new Array(24).fill(0);
    const lines = output.trim().split('\\n');
    for (const line of lines) {
      if (!line) continue;
      const date = new Date(line);
      if (!isNaN(date.getHours())) {
        hours[date.getHours()]++;
      }
    }
    return hours;
  } catch (error) {
    return new Array(24).fill(0);
  }
}

function getPRVelocityTier() {
  try {
    // Get merged PRs in last 14 days
    const mergedOutput = execSync('gh pr list --state merged --json mergedAt -L 100', { cwd: rootDir, stdio: 'pipe' }).toString();
    const mergedPRs = JSON.parse(mergedOutput);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentPRs = mergedPRs.filter(pr => new Date(pr.mergedAt) > twoWeeksAgo).length;

    if (recentPRs > 20) return 'high';
    if (recentPRs > 10) return 'active';
    if (recentPRs > 5) return 'standard';
    if (recentPRs > 1) return 'low-churn';
    return 'dormant';
  } catch (error) {
    console.warn("Could not determine PR velocity, defaulting to 'standard' tier.");
    return 'standard';
  }
}

function computeOptimalSchedule() {
  const commitHours = getCommitFrequencyByHour();
  const velocityTier = getPRVelocityTier();

  // Find the quietest 4-hour window
  let minCommits = Infinity;
  let quietestStartHour = 0;

  for (let i = 0; i < 24; i++) {
    let windowCommits = 0;
    for (let j = 0; j < 4; j++) {
      windowCommits += commitHours[(i + j) % 24];
    }
    if (windowCommits < minCommits) {
      minCommits = windowCommits;
      quietestStartHour = i;
    }
  }

  // Schedule right before the quietest window
  const scheduleHour = (quietestStartHour > 0) ? quietestStartHour - 1 : 23;

  let cronExpression;
  let rationale;

  switch (velocityTier) {
    case 'high':
      // High velocity: run every 6 hours, starting relative to quiet period
      cronExpression = `0 ${(scheduleHour) % 24},${(scheduleHour+6) % 24},${(scheduleHour+12) % 24},${(scheduleHour+18) % 24} * * *`;
      rationale = `High PR velocity detected. Scheduled 4 times daily (starting immediately preceding quietest historical window at ${quietestStartHour}:00 UTC).`;
      break;
    case 'active':
      // Active velocity: run every 12 hours
      cronExpression = `0 ${(scheduleHour) % 24},${(scheduleHour+12) % 24} * * *`;
      rationale = `Active PR velocity detected. Scheduled twice daily (starting immediately preceding quietest historical window at ${quietestStartHour}:00 UTC).`;
      break;
    case 'standard':
      // Standard velocity: run daily
      cronExpression = `0 ${scheduleHour} * * *`;
      rationale = `Standard PR velocity detected. Scheduled daily at ${scheduleHour}:00 UTC (immediately preceding quietest historical window at ${quietestStartHour}:00 UTC).`;
      break;
    case 'low-churn':
      // Low churn: run twice a week (Mon, Thu)
      cronExpression = `0 ${scheduleHour} * * 1,4`;
      rationale = `Low PR churn detected. Scheduled twice weekly (Mon/Thu) at ${scheduleHour}:00 UTC.`;
      break;
    case 'dormant':
      // Dormant: run weekly (Sunday)
      cronExpression = `0 ${scheduleHour} * * 0`;
      rationale = `Dormant PR velocity detected. Scheduled weekly on Sundays at ${scheduleHour}:00 UTC.`;
      break;
    default:
      cronExpression = `0 ${scheduleHour} * * *`;
      rationale = `Default scheduling (daily) at ${scheduleHour}:00 UTC.`;
  }

  return { cron: cronExpression, rationale };
}

function main() {
  console.log('Computing optimal self-heal schedule...');

  let currentSchedule = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      currentSchedule = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || {};
    } catch (error) {
      console.warn('Could not read existing schedule file, proceeding with defaults.');
    }
  }

  // Oscillation guard
  if (currentSchedule.last_updated) {
    const lastUpdated = new Date(currentSchedule.last_updated).getTime();
    if (Date.now() - lastUpdated < MIN_UPDATE_INTERVAL_MS) {
      console.log('Schedule was updated recently. Skipping recomputation to prevent oscillation.');
      process.exit(0);
    }
  }

  const { cron, rationale } = computeOptimalSchedule();
  console.log(`Computed Cron: ${cron}`);
  console.log(`Rationale: ${rationale}`);

  if (currentSchedule.cron === cron) {
    console.log('Computed schedule matches existing schedule. No update needed.');
    process.exit(0);
  }

  // Update schedule metadata file
  const newScheduleData = {
    cron,
    rationale,
    last_updated: new Date().toISOString()
  };
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newScheduleData), 'utf8');
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Update workflow file
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');

    // Safely update using yaml parsing
    try {
        const workflowDoc = yaml.load(workflowContent);
        if (workflowDoc && workflowDoc.on && workflowDoc.on.schedule && Array.isArray(workflowDoc.on.schedule)) {
            workflowDoc.on.schedule[0].cron = cron;
            // Note: js-yaml drops comments. To preserve the `# AUTO-UPDATED` marker and general workflow formatting,
            // we will use regex replacement anchored to the `# AUTO-UPDATED` marker as requested by the prompt constraints for fallback.
        }
    } catch(e) {
        console.error("Could not parse workflow yaml", e);
    }

    const updatedWorkflowContent = workflowContent.replace(/cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED/g, `cron: '${cron}' # AUTO-UPDATED`);

    // Validate output is parseable
    try {
      yaml.load(updatedWorkflowContent);
      fs.writeFileSync(WORKFLOW_FILE, updatedWorkflowContent, 'utf8');
      console.log(`Updated ${WORKFLOW_FILE}`);
    } catch (error) {
      console.error('Failed to validate generated YAML. Aborting update to prevent workflow breakage.', error);
      process.exit(1);
    }
  } else {
    console.warn(`Workflow file ${WORKFLOW_FILE} not found. Ensure it is created.`);
  }
}

main();

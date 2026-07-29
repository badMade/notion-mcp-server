#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

// Oscillation guard: 3 days in ms
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
const SCHEDULE_FILE = '.github/self-heal-schedule.yml';

function run(command) {
  try {
    return execSync(command).toString().trim();
  } catch (error) {
    return '';
  }
}

function getTelemetry() {
  // Simple heuristic for demo: count commits in the last 30 days
  const commits = run('git rev-list --count --since="30 days ago" HEAD');
  const commitCount = parseInt(commits || '0', 10);

  // Real implementation might use `gh pr list` for PR velocity as well,
  // but requires GH_TOKEN and full git history.
  // For the purpose of the scheduling logic described:

  if (commitCount > 50) return 'high';
  if (commitCount > 20) return 'active';
  if (commitCount > 5) return 'standard';
  if (commitCount > 0) return 'low-churn';
  return 'dormant';
}

function getCronForTier(tier) {
  switch (tier) {
    case 'high': return '0 */4 * * *'; // Every 4 hours
    case 'active': return '0 */8 * * *'; // Every 8 hours
    case 'standard': return '0 2 * * *'; // Once a day at 2am
    case 'low-churn': return '0 2 * * 1'; // Once a week on Monday at 2am
    case 'dormant': return '0 2 1 * *'; // Once a month
    default: return '0 2 * * *';
  }
}

function main() {
  console.log('Computing new schedule...');
  let currentSchedule = {};

  if (existsSync(SCHEDULE_FILE)) {
    const fileContent = readFileSync(SCHEDULE_FILE, 'utf8');
    currentSchedule = yaml.load(fileContent) || {};
  }

  const lastUpdated = currentSchedule.LAST_UPDATED ? new Date(currentSchedule.LAST_UPDATED).getTime() : 0;
  const now = Date.now();

  // Skip if we updated recently, unless it's missing
  if (currentSchedule.schedule && (now - lastUpdated < MIN_UPDATE_INTERVAL_MS)) {
    console.log(`Skipping update. Last update was less than 3 days ago.`);
    process.exit(0);
  }

  const tier = getTelemetry();
  const cron = getCronForTier(tier);

  console.log(`Telemetry tier: ${tier}`);
  console.log(`Computed cron: ${cron}`);

  if (currentSchedule.schedule === cron) {
    console.log('Schedule is unchanged.');
    process.exit(0);
  }

  const newConfig = {
    schedule: cron,
    rationale: `Computed automatically based on project velocity tier: ${tier}`,
    LAST_UPDATED: new Date().toISOString()
  };

  // forceQuotes ensures the cron string is quoted "0 0 * * *"
  const yamlContent = yaml.dump(newConfig, { forceQuotes: true });

  writeFileSync(SCHEDULE_FILE, yamlContent);
  console.log(`Updated ${SCHEDULE_FILE}`);
}

main();

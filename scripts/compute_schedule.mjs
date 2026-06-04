#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import yaml from 'js-yaml';

const CONFIG_PATH = '.github/self-heal-schedule.yml';
const WORKFLOW_PATH = '.github/workflows/self-heal.yml';

function readConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(content) || {};
  }
  return { schedule: '0 0 * * *', rationale: 'Default', last_updated: 0, override: false };
}

function writeConfig(config) {
  config.last_updated = Date.now();
  const content = yaml.dump(config, { forceQuotes: true });
  fs.writeFileSync(CONFIG_PATH, content, 'utf8');
}

function updateWorkflowSchedule(newSchedule) {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  // Match the cron line with the # AUTO-UPDATED marker
  const updated = content.replace(
    /cron:\s*".*?"\s*# AUTO-UPDATED/,
    `cron: "${newSchedule}" # AUTO-UPDATED`
  );
  fs.writeFileSync(WORKFLOW_PATH, updated, 'utf8');
}

function getCommitCount(days) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const count = execSync(`git log --since="${since}" --oneline | wc -l`, { encoding: 'utf8' });
    return parseInt(count.trim(), 10) || 0;
  } catch (e) {
    return 0;
  }
}

function computeOptimalSchedule() {
  const commitsLast7Days = getCommitCount(7);
  let schedule = '0 0 * * *'; // Daily default
  let rationale = `Standard activity (${commitsLast7Days} commits in 7 days). Daily schedule.`;

  if (commitsLast7Days > 50) {
    schedule = '0 */6 * * *'; // Every 6 hours
    rationale = `High activity (${commitsLast7Days} commits in 7 days). Frequent schedule (every 6h).`;
  } else if (commitsLast7Days > 20) {
    schedule = '0 */12 * * *'; // Every 12 hours
    rationale = `Active repository (${commitsLast7Days} commits in 7 days). Twice-daily schedule.`;
  } else if (commitsLast7Days === 0) {
    schedule = '0 0 * * 0'; // Weekly
    rationale = `Dormant repository (0 commits in 7 days). Weekly schedule.`;
  }

  return { schedule, rationale };
}

console.log('Computing self-heal schedule...');
const config = readConfig();

if (config.override) {
  console.log('Manual override detected in config. Skipping automatic computation.');
  process.exit(0);
}

// Oscillation guard (3 days)
const DAYS_3_MS = 3 * 24 * 60 * 60 * 1000;
if (config.last_updated && (Date.now() - config.last_updated < DAYS_3_MS)) {
  console.log('Schedule was updated recently. Skipping recomputation to prevent thrashing.');
  process.exit(0);
}

const { schedule, rationale } = computeOptimalSchedule();

if (schedule !== config.schedule) {
  console.log(`Schedule changing from ${config.schedule} to ${schedule}`);
  config.schedule = schedule;
  config.rationale = rationale;

  writeConfig(config);
  updateWorkflowSchedule(schedule);
  console.log('Schedule updated successfully.');
} else {
  console.log('Computed schedule matches existing schedule. No changes needed.');
}

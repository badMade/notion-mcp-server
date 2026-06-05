#!/usr/bin/env node

/**
 * Computes an adaptive schedule for the self-healing workflow.
 * Reads basic git telemetry (or uses safe fallbacks if history is shallow).
 * Uses js-yaml to round-trip update .github/self-heal-schedule.yml
 * and sed to update .github/workflows/self-heal.yml safely.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import yaml from 'js-yaml';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
const OSCILLATION_GUARD_DAYS = 3;

const TIERS = {
  high: '0 0,12 * * *',
  active: '0 2 * * *',
  standard: '0 3 * * 1,3,5',
  infrequent: '0 4 * * 1',
  dormant: '0 5 1 * *'
};

function getCommitCount(days) {
  try {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const count = execSync(`git rev-list --count HEAD --since="${sinceDate}"`, { encoding: 'utf-8' });
    return parseInt(count.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function computeTier() {
  const commitsLast7Days = getCommitCount(7);
  let tier = 'dormant';
  if (commitsLast7Days > 50) tier = 'high';
  else if (commitsLast7Days > 20) tier = 'active';
  else if (commitsLast7Days > 5) tier = 'standard';
  else if (commitsLast7Days > 0) tier = 'infrequent';
  return { tier, cron: TIERS[tier], commits: commitsLast7Days };
}

function main() {
  console.log('Computing new schedule...');

  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.error(`Missing ${SCHEDULE_FILE}. Please create it first.`);
    process.exit(1);
  }

  const rawConfig = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
  let config;
  try {
    config = yaml.load(rawConfig);
  } catch (err) {
    console.error('Failed to parse schedule config:', err);
    process.exit(1);
  }

  const lastUpdated = config.last_updated ? new Date(config.last_updated) : new Date(0);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < OSCILLATION_GUARD_DAYS) {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago (less than ${OSCILLATION_GUARD_DAYS}). Skipping recompute to avoid oscillation.`);
    process.exit(0);
  }

  const { tier, cron, commits } = computeTier();
  console.log(`Computed tier: ${tier} (${cron}) based on ${commits} commits in last 7 days.`);

  if (config.schedule === cron) {
    console.log('Schedule unchanged. No updates needed.');
    process.exit(0);
  }

  console.log(`Updating schedule from '${config.schedule}' to '${cron}'...`);

  config.schedule = cron;
  config.rationale = `Auto-computed to '${tier}' tier based on ${commits} commits in the last 7 days.`;
  config.last_updated = new Date().toISOString();

  const updatedYaml = yaml.dump(config, { forceQuotes: true });
  fs.writeFileSync(SCHEDULE_FILE, updatedYaml, 'utf-8');

  if (fs.existsSync(WORKFLOW_FILE)) {
    try {
      execSync(`sed -i 's/.*cron:.*# AUTO-UPDATED/    - cron: "${cron}" # AUTO-UPDATED/' ${WORKFLOW_FILE}`);
      console.log('Workflow file updated successfully.');
    } catch (err) {
      console.error('Failed to update workflow file with sed:', err);
      process.exit(1);
    }
  }

  console.log('Schedule update complete.');
}

main();

#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import yaml from 'js-yaml';

// Guard: Ensure gh CLI is available
try {
  execSync('gh --version', { stdio: 'ignore' });
} catch (e) {
  console.log('GitHub CLI (gh) is not available. Skipping schedule computation.');
  process.exit(0);
}

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// 1. Check if we should recompute (Oscillation Guard)
let currentConfig = { schedule: '0 0 * * *', rationale: 'Bootstrap schedule', lastUpdated: 0 };
if (fs.existsSync(SCHEDULE_FILE)) {
  const content = fs.readFileSync(SCHEDULE_FILE, 'utf8');
  try {
    currentConfig = yaml.load(content) || currentConfig;
  } catch (e) {
    console.warn('Failed to parse existing schedule file. Overwriting.');
  }
}

const now = Date.now();
if (now - currentConfig.lastUpdated < MIN_UPDATE_INTERVAL_MS) {
  console.log('Schedule updated recently. Skipping computation to avoid oscillation.');
  process.exit(0);
}

// 2. Fetch Telemetry
let prs = [];
try {
  const output = execSync('gh pr list --state merged --json mergedAt --limit 100').toString();
  prs = JSON.parse(output);
} catch (e) {
  console.warn('Failed to fetch PR telemetry:', e.message);
}

const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
const recentPrs = prs.filter(pr => pr.mergedAt >= oneMonthAgo).length;

// 3. Compute Schedule
let newSchedule = '0 0 * * *'; // Default: Standard tier (Daily)
let rationale = 'Standard tier (Daily) due to moderate PR velocity.';

if (recentPrs > 20) {
  newSchedule = '0 */6 * * *'; // High tier (Every 6 hours)
  rationale = 'High tier (Every 6 hours) due to high PR velocity (>20 merged in 30 days).';
} else if (recentPrs > 5) {
  newSchedule = '0 */12 * * *'; // Active tier (Every 12 hours)
  rationale = 'Active tier (Every 12 hours) due to active PR velocity (6-20 merged in 30 days).';
} else if (recentPrs === 0) {
  newSchedule = '0 0 * * 0'; // Dormant tier (Weekly)
  rationale = 'Dormant tier (Weekly) due to no merged PRs in 30 days.';
}

if (newSchedule === currentConfig.schedule) {
  console.log('Schedule unchanged based on telemetry. No update needed.');
  // We still update the lastUpdated timestamp so we don't keep checking
  const newConfig = {
    ...currentConfig,
    lastUpdated: now
  };
  const yamlOutput = yaml.dump(newConfig, { forceQuotes: true });
  fs.writeFileSync(SCHEDULE_FILE, yamlOutput);
  process.exit(0);
}

console.log(`Computing new schedule: ${newSchedule}`);
console.log(`Rationale: ${rationale}`);

// 4. Update the schedule file
const newConfig = {
  schedule: newSchedule,
  rationale: rationale,
  lastUpdated: now
};

const yamlOutput = yaml.dump(newConfig, { forceQuotes: true });
fs.writeFileSync(SCHEDULE_FILE, yamlOutput);

console.log(`Updated ${SCHEDULE_FILE}`);

// Set GitHub Output for workflow
const githubEnv = process.env.GITHUB_OUTPUT;
if (githubEnv) {
  fs.appendFileSync(githubEnv, `schedule_updated=true\n`);
}

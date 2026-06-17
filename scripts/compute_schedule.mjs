#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

// Threshold: Skip if updated within the last 3 days
const OSCILLATION_GUARD_DAYS = 3;

// Telemetry bounds
const DEFAULT_CRON = "0 2 * * *"; // fallback to daily at 2 AM
const TIERS = {
  high: "0 */4 * * *",       // Every 4 hours
  active: "0 */8 * * *",     // Every 8 hours
  standard: "0 2 * * *",     // Daily
  low_churn: "0 0 * * 0",    // Weekly
  dormant: "0 0 1 * *"       // Monthly
};

const getCommitCount = () => {
  try {
    const output = execSync('git rev-list --count --since="7 days.ago" HEAD').toString().trim();
    return parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
};

const computeTier = (commitsLast7Days) => {
  if (commitsLast7Days > 50) return 'high';
  if (commitsLast7Days > 20) return 'active';
  if (commitsLast7Days > 5) return 'standard';
  if (commitsLast7Days > 0) return 'low_churn';
  return 'dormant';
};

console.log('--- Computing Schedule ---');

let currentConfig = { schedule: DEFAULT_CRON, last_updated: 0 };
if (fs.existsSync(SCHEDULE_FILE)) {
  const content = fs.readFileSync(SCHEDULE_FILE, 'utf8');
  try {
    currentConfig = yaml.load(content) || currentConfig;
  } catch (err) {
    console.error('Failed to parse schedule file, using defaults.', err);
  }
}

const now = Date.now();
const daysSinceUpdate = (now - (currentConfig.last_updated || 0)) / (1000 * 60 * 60 * 24);

if (daysSinceUpdate < OSCILLATION_GUARD_DAYS) {
  console.log(`Oscillation guard active. Last updated ${daysSinceUpdate.toFixed(1)} days ago. Skipping recompute.`);
  process.exit(0);
}

const commits = getCommitCount();
const targetTier = computeTier(commits);
const newCron = TIERS[targetTier] || DEFAULT_CRON;

console.log(`Telemetry: ${commits} commits in last 7 days.`);
console.log(`Target Tier: ${targetTier} -> Cron: ${newCron}`);

if (newCron === currentConfig.schedule) {
  console.log('Schedule unchanged. No updates needed.');
  process.exit(0);
}

// 1. Update Schedule YAML
const newConfig = {
  schedule: newCron,
  rationale: `Computed tier '${targetTier}' based on ${commits} commits in the past 7 days.`,
  last_updated: now
};

fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newConfig, { forceQuotes: true }));
console.log(`Updated ${SCHEDULE_FILE}`);

// 2. Update Workflow YAML (via strict string replacement to preserve anchors/comments)
if (fs.existsSync(WORKFLOW_FILE)) {
  let wfContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
  // Match a cron line containing the marker
  wfContent = wfContent.replace(/cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g, `cron: "${newCron}" # AUTO-UPDATED`);
  fs.writeFileSync(WORKFLOW_FILE, wfContent);
  console.log(`Updated ${WORKFLOW_FILE}`);
}

process.exit(0);

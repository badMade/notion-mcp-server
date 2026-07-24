#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';

console.log('Computing optimal self-heal schedule...');

// Ensure schedule file exists or create default
if (!fs.existsSync(SCHEDULE_FILE)) {
  console.log('Schedule file not found. Creating default...');
  const defaultDir = path.dirname(SCHEDULE_FILE);
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const defaultData = {
    schedule: '0 2 * * *',
    rationale: 'Default initial schedule.',
    last_updated: new Date().toISOString()
  };

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(defaultData));
}

// 1. Read existing metadata for oscillation guard
let metadata;
try {
  metadata = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
} catch (e) {
  console.error('Failed to parse schedule file', e);
  process.exit(1);
}

const lastUpdated = new Date(metadata.last_updated);
const now = new Date();
const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

// Schedule oscillation guard: skip if updated in the last 24 hours
if (hoursSinceUpdate < 24) {
  console.log(`Schedule was updated ${hoursSinceUpdate.toFixed(2)} hours ago. Skipping recompute to prevent oscillation.`);
  // Output a marker so the workflow knows whether to skip
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_updated=false\n');
  }
  process.exit(0);
}

// 2. Fetch Telemetry
let prCount = 0;
let ciFailureCount = 0;

try {
  // Rough estimate of PRs merged in the last 7 days (assuming `gh` is available)
  // We use a safe fallback if gh is not installed or fails
  const prJson = execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  const prs = JSON.parse(prJson);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  prCount = prs.filter(pr => new Date(pr.mergedAt) > oneWeekAgo).length;
} catch (err) {
  console.log('Warning: Could not fetch PR telemetry (gh CLI might be missing). Using fallback logic.');
}

try {
  const ciJson = execSync('gh run list --workflow=ci --json conclusion --limit 50', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  const runs = JSON.parse(ciJson);
  ciFailureCount = runs.filter(run => run.conclusion === 'failure').length;
} catch (err) {
  console.log('Warning: Could not fetch CI telemetry.');
}

// 3. Active-period detection
let quietHour = 2; // Default to 2 AM UTC
try {
  const commitDates = execSync('git log --format=%aI --limit 100', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  const hours = commitDates.trim().split('\n').filter(Boolean).map(dateStr => new Date(dateStr).getUTCHours());

  if (hours.length > 0) {
    // Count frequencies of each hour
    const hourCounts = new Array(24).fill(0);
    hours.forEach(h => hourCounts[h]++);

    // Find the longest contiguous window of inactivity (or lowest activity)
    // A simple heuristic is to find the hour with the minimum commits
    quietHour = hourCounts.indexOf(Math.min(...hourCounts));
    console.log(`Detected quietest hour: ${quietHour} UTC`);
  }
} catch (err) {
  console.log('Warning: Could not fetch commit history for active-period detection. Defaulting to 2 AM.');
}

// 4. Compute Cadence Tier
let cronExpr = `0 ${quietHour} * * *`;
let rationale = 'Default fallback cadence.';

if (prCount > 30 || ciFailureCount > 10) {
  // High velocity: 4 times a day, starting at quiet hour
  cronExpr = `0 ${quietHour},${(quietHour+6)%24},${(quietHour+12)%24},${(quietHour+18)%24} * * *`;
  rationale = `High activity detected (${prCount} PRs, ${ciFailureCount} CI failures in last week). Computing frequent schedule.`;
} else if (prCount > 10 || ciFailureCount > 3) {
  // Active: 2 times a day, starting at quiet hour
  cronExpr = `0 ${quietHour},${(quietHour+12)%24} * * *`;
  rationale = `Active project detected (${prCount} PRs, ${ciFailureCount} CI failures in last week). Computing moderate schedule.`;
} else if (prCount > 0) {
  // Standard: once a day at quiet hour
  cronExpr = `0 ${quietHour} * * *`;
  rationale = `Standard activity detected (${prCount} PRs). Computing daily schedule.`;
} else {
  // Dormant: once a week on Sunday at quiet hour
  cronExpr = `0 ${quietHour} * * 0`;
  rationale = `Low activity detected (${prCount} PRs). Computing weekly schedule.`;
}

console.log(`Computed Schedule: ${cronExpr}`);
console.log(`Rationale: ${rationale}`);

// 5. Check if update is needed
if (metadata.schedule === cronExpr) {
  console.log('Schedule unchanged. No update required.');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_updated=false\n');
  }
  process.exit(0);
}

// 6. Update YAML safely
metadata.schedule = cronExpr;
metadata.rationale = rationale;
metadata.last_updated = new Date().toISOString();

try {
  const newYaml = yaml.dump(metadata);
  fs.writeFileSync(SCHEDULE_FILE, newYaml);
  console.log(`Successfully updated ${SCHEDULE_FILE}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_updated=true\n');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_schedule=${cronExpr}\n`);
  }
} catch (err) {
  console.error('Failed to write updated schedule file', err);
  process.exit(1);
}

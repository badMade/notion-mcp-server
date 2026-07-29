#!/usr/bin/env node

/**
 * Compute Schedule Script
 * Analyzes repository telemetry (PRs, CI failures, etc.) over a lookback window
 * to determine the optimal cron schedule for self-healing.
 * Implements oscillation guard and uses js-yaml with forceQuotes.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

// Helper to run shell commands silently
function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (err) {
    return null;
  }
}

// Ensure GH token is available for gh cli
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.log('⚠️ No GH_TOKEN found, telemetry might fail or use fallbacks.');
}

// 1. Get telemetry
console.log('📊 Gathering telemetry...');
const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

// Count PRs merged in last 30 days
let prCount = 0;
const prsJson = runCmd(`gh pr list --state merged --search "merged:>=${thirtyDaysAgo}" --json mergedAt`);
if (prsJson) {
  try {
    const prs = JSON.parse(prsJson);
    prCount = prs.length;
  } catch (e) {
    console.error('Failed to parse gh pr list output.', e);
  }
} else {
    // fallback if gh fails: count git commits in last 30 days
    const commits = runCmd(`git rev-list --count HEAD --since="30 days ago"`);
    if(commits) prCount = parseInt(commits, 10);
}

console.log(`- PRs/Commits in last 30 days: ${prCount}`);

// 2. Determine cadence tier based on PR velocity
let newSchedule = '0 0 * * *'; // default: daily
let rationale = 'Default schedule.';
let tier = 'standard';

if (prCount > 50) {
  tier = 'high';
  newSchedule = '0 */6 * * *'; // Every 6 hours
  rationale = 'High PR velocity (>50 per month). Scheduling multiple runs per day.';
} else if (prCount > 20) {
  tier = 'active';
  newSchedule = '0 */12 * * *'; // Every 12 hours
  rationale = 'Active PR velocity (>20 per month). Scheduling twice per day.';
} else if (prCount > 5) {
  tier = 'standard';
  newSchedule = '0 0 * * *'; // Daily
  rationale = 'Standard PR velocity (>5 per month). Scheduling once per day.';
} else if (prCount > 0) {
  tier = 'low-churn';
  newSchedule = '0 0 * * 1,4'; // Twice a week
  rationale = 'Low churn. Scheduling twice a week.';
} else {
  tier = 'dormant';
  newSchedule = '0 0 * * 1'; // Weekly
  rationale = 'Dormant repository. Scheduling once a week.';
}

console.log(`- Computed tier: ${tier}`);
console.log(`- Computed schedule: ${newSchedule}`);

// 3. Load existing schedule
let currentConfig = {};
if (fs.existsSync(SCHEDULE_FILE)) {
  try {
    const fileContents = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    currentConfig = yaml.load(fileContents) || {};
  } catch (e) {
    console.error('Failed to read existing schedule file.', e);
  }
}

// 4. Oscillation guard
const lastUpdatedStr = currentConfig.LAST_UPDATED;
if (lastUpdatedStr) {
  const lastUpdated = new Date(lastUpdatedStr);
  const diffDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 3 && currentConfig.SCHEDULE !== newSchedule) {
    console.log(`⏳ Schedule was updated ${diffDays.toFixed(1)} days ago. Skipping update to prevent oscillation.`);
    process.exit(0); // Exit successfully, no change needed
  }
}

// Check if schedule actually changed
if (currentConfig.SCHEDULE === newSchedule) {
  console.log('✅ Schedule is already optimal. No changes needed.');
  process.exit(0);
}

// 5. Apply changes
console.log('🔄 Updating schedule...');

// Write metadata file
const newConfig = {
  SCHEDULE: newSchedule,
  RATIONALE: rationale,
  LAST_UPDATED: now.toISOString(),
};

// Use forceQuotes to ensure "0 0 * * *" instead of unquoted or single quoted
fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newConfig, { forceQuotes: true }), 'utf8');

// Update workflow file using sed fallback if we can't reliably parse/preserve comments with js-yaml
if (fs.existsSync(WORKFLOW_FILE)) {
  let wfContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
  // Match a cron line that ends with the # AUTO-UPDATED marker
  const cronRegex = /cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g;
  if (cronRegex.test(wfContent)) {
    wfContent = wfContent.replace(cronRegex, `cron: "${newSchedule}" # AUTO-UPDATED`);
    fs.writeFileSync(WORKFLOW_FILE, wfContent, 'utf8');
    console.log('✅ Updated workflow file cron schedule via marker.');
  } else {
      console.log('⚠️ Could not find cron line with # AUTO-UPDATED marker in workflow file. Not updating workflow file inline.');
  }
}

console.log(`🎉 Schedule successfully updated to: ${newSchedule}`);

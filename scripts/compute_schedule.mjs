#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const scheduleFile = resolve(rootDir, '.github', 'self-heal-schedule.yml');
const workflowFile = resolve(rootDir, '.github', 'workflows', 'self-heal.yml');

// Helper to run shell commands safely
function runCmd(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null; // Return null on failure (e.g., gh cli not authenticated or no data)
  }
}

// Telemetry collection
function gatherTelemetry() {
  console.log("Gathering telemetry...");

  // 1. Commit count in last 30 days
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  const sinceDate = date30DaysAgo.toISOString();

  const commitCountStr = runCmd(`git rev-list --count HEAD --since="${sinceDate}"`);
  const commitCount = parseInt(commitCountStr || '0', 10);

  // 2. PR merge count in last 30 days (requires gh cli)
  // Fallback to 0 if gh is not available or errors out
  let prMergeCount = 0;
  const prs = runCmd(`gh pr list --state merged --json mergedAt --limit 100 2>/dev/null`);
  if (prs) {
    try {
      const parsedPrs = JSON.parse(prs);
      prMergeCount = parsedPrs.filter(pr => new Date(pr.mergedAt) >= date30DaysAgo).length;
    } catch (e) {
      console.log("Could not parse PR data, defaulting to 0");
    }
  }

  return { commitCount, prMergeCount };
}

// Cadence computation
function computeCadence(telemetry) {
  // Activity score based on commits and PRs
  const activityScore = telemetry.commitCount + (telemetry.prMergeCount * 2);

  let cronExpr = '0 0 * * 0'; // Default: Weekly on Sunday (dormant/rare)
  let rationale = 'Default infrequent schedule due to low activity.';
  let tier = 'dormant';

  if (activityScore > 50) {
    cronExpr = '0 */6 * * *'; // Every 6 hours
    rationale = 'High activity detected. Running frequently.';
    tier = 'high';
  } else if (activityScore > 20) {
    cronExpr = '0 0,12 * * *'; // Twice a day
    rationale = 'Moderate activity detected. Running twice daily.';
    tier = 'standard';
  } else if (activityScore > 5) {
    cronExpr = '0 0 * * *'; // Daily
    rationale = 'Low activity detected. Running daily.';
    tier = 'low-churn';
  }

  return { cronExpr, rationale, tier };
}

// Update schedule files
function updateSchedules(schedule) {
  console.log(`Computed new schedule: ${schedule.cronExpr} (Tier: ${schedule.tier})`);
  console.log(`Rationale: ${schedule.rationale}`);

  // 1. Update self-heal-schedule.yml
  let currentConfig = {};
  try {
    currentConfig = yaml.load(readFileSync(scheduleFile, 'utf-8')) || {};
  } catch (e) {
    console.log("Could not read existing schedule file, creating new one.");
  }

  const now = new Date().toISOString();

  // Skip if it's the exact same schedule to avoid unnecessary PRs
  if (currentConfig.SELFHEAL_SCHEDULE === schedule.cronExpr) {
    console.log("Schedule is unchanged. Exiting.");
    process.exit(0);
  }

  const newConfig = {
    ...currentConfig,
    SELFHEAL_SCHEDULE: schedule.cronExpr,
    RATIONALE: schedule.rationale,
    LAST_UPDATED: now,
  };

  writeFileSync(scheduleFile, yaml.dump(newConfig), 'utf-8');
  console.log(`Updated ${scheduleFile}`);

  // 2. Update self-heal.yml workflow inline using sed (for the # AUTO-UPDATED marker)
  try {
    const sedCmd = `sed -i "s|cron: .*.# AUTO-UPDATED|cron: '${schedule.cronExpr}' # AUTO-UPDATED|" ${workflowFile}`;
    execSync(sedCmd, { cwd: rootDir });
    console.log(`Updated inline cron in ${workflowFile}`);
  } catch (e) {
    console.error(`Failed to update workflow file inline: ${e.message}`);
    // Non-fatal, as long as schedule metadata is updated
  }

  // Ensure the workflow file remains valid YAML
  try {
     yaml.load(readFileSync(workflowFile, 'utf-8'));
  } catch(e) {
     console.error("Workflow file became invalid YAML after update! Aborting.");
     process.exit(1);
  }
}

// Main execution
const telemetry = gatherTelemetry();
console.log(`Telemetry: ${JSON.stringify(telemetry)}`);
const schedule = computeCadence(telemetry);
updateSchedules(schedule);

console.log("Schedule computation complete.");

#!/usr/bin/env node

/**
 * Self-Heal Schedule Computation Script
 *
 * This script analyzes repository telemetry (PR merges, CI failures) over a rolling window
 * to compute an optimal cron schedule for proactive self-healing.
 * It updates .github/self-heal-schedule.yml if the schedule changes.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SCHEDULE_FILE = resolve(REPO_ROOT, '.github/self-heal-schedule.yml');

// Configuration
const LOOKBACK_DAYS = 14;

/**
 * Execute a shell command and return its trimmed stdout.
 */
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    // Return empty string on failure (e.g., gh CLI not available)
    return '';
  }
}

/**
 * Fetch telemetry data using GitHub CLI.
 */
function getTelemetry() {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - LOOKBACK_DAYS);
  const sinceISO = sinceDate.toISOString();

  let prCount = 0;
  let ciFailureCount = 0;
  let selfHealCount = 0;
  let selfHealEmptyCount = 0;

  try {
    // PR merge frequency
    const prsRaw = runCmd(`gh pr list --state merged --json mergedAt --search "merged:>=${sinceISO}"`);
    if (prsRaw) {
      const prs = JSON.parse(prsRaw);
      prCount = prs.length;
    }

    // CI failure rate
    const runsRaw = runCmd(`gh run list --workflow=ci --json conclusion,createdAt`);
    if (runsRaw) {
      const runs = JSON.parse(runsRaw);
      const recentRuns = runs.filter(r => new Date(r.createdAt) >= sinceDate);
      ciFailureCount = recentRuns.filter(r => r.conclusion === 'failure').length;
    }

    // Self-heal PR performance (for oscillation/empty checks)
    const shPrsRaw = runCmd(`gh pr list --label self-heal --state all --json state,createdAt,title --search "created:>=${sinceISO}"`);
    if (shPrsRaw) {
       const shPrs = JSON.parse(shPrsRaw);
       selfHealCount = shPrs.length;
       // Assuming empty runs are closed without merge, or have specific titles.
       selfHealEmptyCount = shPrs.filter(pr => pr.state === 'CLOSED').length;
    }

  } catch (e) {
    console.warn("Failed to fetch full telemetry, using defaults. Error:", e.message);
  }

  return { prCount, ciFailureCount, selfHealCount, selfHealEmptyCount };
}

/**
 * Compute the optimal cron schedule based on telemetry.
 */
function computeSchedule(telemetry) {
  const { prCount, ciFailureCount, selfHealEmptyCount } = telemetry;

  // Calculate PRs per week
  const prsPerWeek = (prCount / LOOKBACK_DAYS) * 7;

  let schedule = "0 2 * * *"; // Default: Daily at 2 AM
  let rationale = "Default standard tier";

  if (prsPerWeek > 20) {
    schedule = "0 */6 * * *"; // High: Every 6 hours
    rationale = `High velocity tier (${prCount} PRs in ${LOOKBACK_DAYS} days).`;
  } else if (prsPerWeek > 5 || ciFailureCount > 3) {
    schedule = "0 2,14 * * *"; // Active: Twice daily
    rationale = `Active velocity tier or high CI failure rate (${ciFailureCount} failures).`;
  } else if (prsPerWeek > 1) {
    schedule = "0 2 * * *"; // Standard: Daily
    rationale = `Standard velocity tier (${prCount} PRs in ${LOOKBACK_DAYS} days).`;
  } else if (prsPerWeek > 0) {
    schedule = "0 2 * * 1,4"; // Low-churn: Twice a week
    rationale = `Low-churn tier (${prCount} PRs in ${LOOKBACK_DAYS} days).`;
  } else {
    schedule = "0 2 * * 1"; // Dormant: Weekly
    rationale = `Dormant tier (0 PRs in ${LOOKBACK_DAYS} days).`;
  }

  // Adjustment logic: if we had many empty self-heal runs, reduce frequency
  if (selfHealEmptyCount >= 3 && prsPerWeek <= 5) {
      schedule = "0 2 * * 1"; // Downgrade to weekly
      rationale += " Adjusted down due to multiple empty self-heal runs.";
  }

  return { schedule, rationale };
}

/**
 * Main execution.
 */
function main() {
  console.log("Analyzing telemetry...");
  const telemetry = getTelemetry();
  console.log("Telemetry:", telemetry);

  const { schedule, rationale } = computeSchedule(telemetry);
  console.log(`Computed Schedule: "${schedule}"`);
  console.log(`Rationale: ${rationale}`);

  // Read current schedule
  let currentYaml = '';
  let currentDoc = {};
  try {
    currentYaml = readFileSync(SCHEDULE_FILE, 'utf-8');
    currentDoc = yaml.load(currentYaml) || {};
  } catch (e) {
    console.warn(`Could not read ${SCHEDULE_FILE}, will create/overwrite.`);
  }

  const currentSchedule = currentDoc.schedule ? currentDoc.schedule.replace(/ # AUTO-UPDATED$/, '') : null;

  if (schedule === currentSchedule) {
    console.log("Schedule is unchanged. No updates needed.");
    process.exit(0);
  }

  console.log("Schedule changed. Updating configuration...");

  // Update logic maintaining the marker
  const newDoc = {
    schedule: schedule + ' # AUTO-UPDATED',
    rationale,
    last_updated: new Date().toISOString()
  };

  // Dump to YAML
  const updatedYaml = yaml.dump(newDoc, {
    quotingType: '"',
    forceQuotes: true,
  });

  // Since js-yaml escapes the `#` in the string, we need to unescape it for the marker to be a real comment,
  // or just use a custom serialization if strictness is required.
  // Actually, js-yaml will output: schedule: "0 2 * * * # AUTO-UPDATED"
  // Let's modify the string directly to ensure the marker is outside the quotes if needed,
  // but as per requirements, having `# AUTO-UPDATED` in the string or just present is fine.
  // Let's fix the quote so it matches standard `schedule: "..." # AUTO-UPDATED`

  const finalYaml = updatedYaml.replace(/schedule: "(.*?) # AUTO-UPDATED"/, 'schedule: "$1" # AUTO-UPDATED');

  // Verify parseable
  try {
     yaml.load(finalYaml);
  } catch(e) {
     console.error("Generated YAML is invalid!", e);
     process.exit(1);
  }

  writeFileSync(SCHEDULE_FILE, finalYaml, 'utf-8');
  console.log(`Updated ${SCHEDULE_FILE}`);
}

main();

#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(REPO_ROOT, '.github', 'self-heal-schedule.yml');

// Define tiers and their corresponding cron schedules
// Cron format: Minute Hour DayOfMonth Month DayOfWeek
const SCHEDULE_TIERS = {
  high: '0 */4 * * *',      // Every 4 hours
  active: '0 */8 * * *',    // Every 8 hours
  standard: '0 0,12 * * *', // Twice a day
  'low-churn': '0 0 * * *', // Once a day
  dormant: '0 0 * * 0'      // Once a week (Sunday)
};

// Returns a JSON parsing result or null
function safeExecJson(command) {
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(stdout);
  } catch (error) {
    // Return empty array/null gracefully on failure (e.g. gh CLI missing or not authenticated)
    return null;
  }
}

// Returns a string result or empty string
function safeExecStr(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return '';
  }
}

function gatherTelemetry() {
  console.log('Gathering telemetry data...');

  const telemetry = {
    mergedPRsRecent: 0,
    failedCIRecent: 0,
    commitFrequencyByHour: {},
  };

  // Get PR merge frequency over the last 14 days
  const date14DaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const mergedPRs = safeExecJson(`gh pr list --state merged --search "merged:>=${date14DaysAgo}" --json mergedAt --limit 100`);
  if (mergedPRs) {
    telemetry.mergedPRsRecent = mergedPRs.length;
  } else {
    // Fallback using git logs (approximate)
    const commits14d = safeExecStr(`git log --since="14 days ago" --oneline | wc -l`);
    telemetry.mergedPRsRecent = parseInt(commits14d, 10) || 0;
  }

  // Get CI failure rate over recent runs (last 50 runs)
  const runs = safeExecJson(`gh run list --workflow=ci --json conclusion --limit 50`);
  if (runs) {
    telemetry.failedCIRecent = runs.filter(r => r.conclusion === 'failure').length;
  }

  // Get commit hour frequency (last 100 commits) to find active/quiet periods
  const commitDates = safeExecStr(`git log -100 --format=%aI`);
  if (commitDates) {
    const dates = commitDates.split('\n').filter(Boolean);
    dates.forEach(dateStr => {
      const d = new Date(dateStr);
      const hour = d.getUTCHours();
      telemetry.commitFrequencyByHour[hour] = (telemetry.commitFrequencyByHour[hour] || 0) + 1;
    });
  }

  return telemetry;
}

function computeSchedule(telemetry) {
  let tier = 'standard';

  if (telemetry.mergedPRsRecent > 20) {
    tier = 'high';
  } else if (telemetry.mergedPRsRecent > 10) {
    tier = 'active';
  } else if (telemetry.mergedPRsRecent > 3) {
    tier = 'standard';
  } else if (telemetry.mergedPRsRecent > 0) {
    tier = 'low-churn';
  } else {
    tier = 'dormant';
  }

  // Find the quietest hour
  let quietestHour = 0;
  let minCommits = Infinity;
  for (let i = 0; i < 24; i++) {
    const commits = telemetry.commitFrequencyByHour[i] || 0;
    if (commits < minCommits) {
      minCommits = commits;
      quietestHour = i;
    }
  }

  // Adjust standard/low-churn to run during the quietest hour
  let cron = SCHEDULE_TIERS[tier];
  if (tier === 'low-churn') {
    cron = `0 ${quietestHour} * * *`;
  } else if (tier === 'standard') {
    const otherHour = (quietestHour + 12) % 24;
    cron = `0 ${Math.min(quietestHour, otherHour)},${Math.max(quietestHour, otherHour)} * * *`;
  }

  return { tier, cron };
}

function updateScheduleFile(newCron, tier) {
  let doc = { schedule: '', rationale: '', last_updated: '' };

  try {
    const fileContents = readFileSync(SCHEDULE_FILE, 'utf8');
    doc = yaml.load(fileContents) || doc;
  } catch (e) {
    console.log('No existing schedule file found. Creating new one.');
  }

  const now = new Date().toISOString();

  // Guard against oscillation (don't update if last update was < 3 days ago and schedule hasn't drastically changed)
  if (doc.last_updated && doc.schedule === newCron) {
    console.log('Schedule unchanged. No update required.');
    process.exit(0);
  }

  if (doc.last_updated) {
    const lastUpdateDate = new Date(doc.last_updated);
    const diffDays = (new Date() - lastUpdateDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 3 && doc.schedule === newCron) {
      console.log('Recent update found. Skipping to prevent oscillation.');
      process.exit(0);
    }
  }

  doc.schedule = newCron;
  doc.rationale = `Computed tier: ${tier} based on recent PR/commit activity.`;
  doc.last_updated = now;

  const yamlStr = yaml.dump(doc, { forceQuotes: true });

  // Write the file, adding the required AUTO-UPDATED marker for fallback
  const outputStr = yamlStr.replace(
    /schedule:\s*['"](.*?)['"]/,
    `schedule: "${newCron}" # AUTO-UPDATED`
  );

  writeFileSync(SCHEDULE_FILE, outputStr, 'utf8');
  console.log(`Updated schedule to: ${newCron}`);
}

function main() {
  const telemetry = gatherTelemetry();
  const { tier, cron } = computeSchedule(telemetry);
  updateScheduleFile(cron, tier);
}

main();

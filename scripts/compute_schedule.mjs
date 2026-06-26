#!/usr/bin/env node

/**
 * Computes a dynamic cron schedule based on telemetry (PR/commit frequency).
 * Writes output using js-yaml to .github/self-heal-schedule.yml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(ROOT, '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(ROOT, '.github', 'workflows', 'self-heal.yml');

function getTelemetry() {
  try {
    // Attempt to get commit count in the last 7 days
    const recentCommits = parseInt(execSync('git rev-list --count --since="7 days ago" HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim(), 10);
    return { recentCommits };
  } catch (err) {
    console.error('Failed to get telemetry from git, using defaults.', err.message);
    return { recentCommits: 5 }; // fallback
  }
}

function computeSchedule(telemetry) {
  let schedule = '0 0 * * *'; // fallback: daily
  let rationale = 'Default daily schedule';
  let tier = 'dormant';

  if (telemetry.recentCommits > 50) {
    schedule = '0 */6 * * *'; // Every 6 hours
    rationale = 'High velocity detected (>50 commits/week)';
    tier = 'high';
  } else if (telemetry.recentCommits > 20) {
    schedule = '0 */12 * * *'; // Every 12 hours
    rationale = 'Active velocity detected (20-50 commits/week)';
    tier = 'active';
  } else if (telemetry.recentCommits > 5) {
    schedule = '0 0 * * *'; // Daily
    rationale = 'Standard velocity detected (5-20 commits/week)';
    tier = 'standard';
  } else {
    schedule = '0 0 * * 0'; // Weekly
    rationale = 'Low/dormant velocity detected (<5 commits/week)';
    tier = 'dormant';
  }

  return { schedule, rationale, tier };
}

function updateScheduleMetadata(scheduleData) {
  let existing = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      existing = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || {};
    } catch (e) {
      console.warn('Could not parse existing schedule file, creating new.');
    }
  }

  // Oscillation guard
  if (existing.LAST_UPDATED) {
    const lastUpdateDate = new Date(existing.LAST_UPDATED);
    const now = new Date();
    const daysSinceUpdate = (now - lastUpdateDate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 3 && existing.SCHEDULE === scheduleData.schedule) {
       console.log('Schedule updated recently and unchanged. Skipping update.');
       return false;
    }
  }

  if (existing.SCHEDULE === scheduleData.schedule) {
      console.log('Schedule unchanged. Skipping update.');
      return false;
  }

  existing.SCHEDULE = scheduleData.schedule;
  existing.RATIONALE = scheduleData.rationale;
  existing.TIER = scheduleData.tier;
  existing.LAST_UPDATED = new Date().toISOString();

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(existing), 'utf8');
  console.log(`Wrote new schedule to ${SCHEDULE_FILE}`);
  return true;
}

function updateWorkflowFile(schedule) {
  if (!fs.existsSync(WORKFLOW_FILE)) return;

  const content = fs.readFileSync(WORKFLOW_FILE, 'utf8');
  // Update the cron line using a safe sed-like replacement anchored by # AUTO-UPDATED
  const updatedContent = content.replace(
    /- cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g,
    `- cron: '${schedule}' # AUTO-UPDATED`
  );

  if (content !== updatedContent) {
      fs.writeFileSync(WORKFLOW_FILE, updatedContent, 'utf8');
      console.log(`Updated cron expression in ${WORKFLOW_FILE}`);
  }
}

function main() {
  const telemetry = getTelemetry();
  const scheduleData = computeSchedule(telemetry);

  const changed = updateScheduleMetadata(scheduleData);
  if (changed) {
      updateWorkflowFile(scheduleData.schedule);
  }
}

main();

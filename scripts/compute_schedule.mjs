#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE_PATH = path.resolve(REPO_ROOT, '.github/self-heal-schedule.yml');
const WORKFLOW_FILE_PATH = path.resolve(REPO_ROOT, '.github/workflows/self-heal.yml');

// Simplified schedule computation based on commit frequency over last 30 days
function computeSchedule() {
  let commitCount = 0;
  try {
    // Get commit count in last 30 days
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    const dateStr = sinceDate.toISOString();
    const result = execSync(`git log --since="${dateStr}" --format="%h"`, { cwd: REPO_ROOT }).toString();
    commitCount = result.split('\\n').filter(Boolean).length;
  } catch (error) {
    console.error('Failed to get commit history, defaulting to 1 commit:', error.message);
    commitCount = 1; // Default
  }

  console.log(`Detected ${commitCount} commits in the last 30 days.`);

  let schedule = '0 0 * * *'; // Default: Daily at midnight (Standard / Low-churn)
  let rationale = 'Default fallback cadence due to limited commit history.';

  if (commitCount > 50) {
    schedule = '0 */4 * * *'; // High velocity: Every 4 hours
    rationale = 'High velocity tier computed from > 50 commits in 30 days.';
  } else if (commitCount > 20) {
    schedule = '0 */12 * * *'; // Active: Every 12 hours
    rationale = 'Active tier computed from > 20 commits in 30 days.';
  } else if (commitCount > 5) {
    schedule = '0 0 * * *'; // Standard: Daily
    rationale = 'Standard tier computed from > 5 commits in 30 days.';
  } else {
    schedule = '0 0 * * 1'; // Dormant: Weekly
    rationale = 'Dormant tier computed from low commit volume.';
  }

  return { schedule, rationale };
}

async function updateScheduleFiles(newSchedule, rationale) {
  // Update .github/self-heal-schedule.yml safely using js-yaml
  const scheduleData = {
    schedule: newSchedule,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  const yamlStr = yaml.dump(scheduleData, { forceQuotes: true });
  await fs.writeFile(SCHEDULE_FILE_PATH, yamlStr, 'utf8');
  console.log(`Updated ${SCHEDULE_FILE_PATH}`);

  // Also try to update the cron line in .github/workflows/self-heal.yml if it exists
  try {
    let workflowContent = await fs.readFile(WORKFLOW_FILE_PATH, 'utf8');
    // Using sed-like replacement anchored by # AUTO-UPDATED
    const regex = /cron:\\s*['"].*?['"]\\s*# AUTO-UPDATED/g;
    if (regex.test(workflowContent)) {
       workflowContent = workflowContent.replace(regex, `cron: "${newSchedule}" # AUTO-UPDATED`);
       await fs.writeFile(WORKFLOW_FILE_PATH, workflowContent, 'utf8');
       console.log(`Updated schedule in ${WORKFLOW_FILE_PATH}`);
    }
  } catch (err) {
    // It's ok if the workflow file doesn't exist yet
    console.log(`Could not update ${WORKFLOW_FILE_PATH}: ${err.message}`);
  }
}

async function main() {
  console.log('Computing new schedule...');
  const { schedule, rationale } = computeSchedule();
  console.log(`Computed Schedule: ${schedule}`);
  console.log(`Rationale: ${rationale}`);

  await updateScheduleFiles(schedule, rationale);
}

main().catch(console.error);

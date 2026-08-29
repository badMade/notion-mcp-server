#!/usr/bin/env node

/**
 * Compute Schedule Script
 * Analyzes repository telemetry (commits/PRs) to compute an optimal cron schedule.
 * Updates .github/self-heal-schedule.yml and .github/workflows/self-heal.yml safely.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const scheduleFilePath = join(rootDir, '.github/self-heal-schedule.yml');
const workflowFilePath = join(rootDir, '.github/workflows/self-heal.yml');

function getTelemetry() {
  try {
    const commitLog = execSync('git log --format=%aI --since="30 days ago"', { cwd: rootDir, stdio: 'pipe' }).toString();
    const commitCount = commitLog.trim().split('\n').filter(Boolean).length;
    return { commitCount };
  } catch (error) {
    console.log('Telemetry unavailable (likely shallow clone or no history). Using defaults.');
    return { commitCount: 0 };
  }
}

function computeSchedule(telemetry) {
  const { commitCount } = telemetry;
  let schedule = '0 3 * * *'; // Default: Daily at 3 AM
  let tier = 'dormant';

  if (commitCount > 100) {
    schedule = '0 */6 * * *'; // High: Every 6 hours
    tier = 'high';
  } else if (commitCount > 50) {
    schedule = '0 */12 * * *'; // Active: Every 12 hours
    tier = 'active';
  } else if (commitCount > 10) {
    schedule = '0 3 * * *'; // Standard: Daily
    tier = 'standard';
  } else if (commitCount > 0) {
    schedule = '0 3 * * 1,4'; // Low-churn: Twice a week
    tier = 'low-churn';
  } else {
    schedule = '0 3 1 * *'; // Dormant: Monthly
    tier = 'dormant';
  }

  return { schedule, tier };
}

function updateScheduleFiles(newSchedule, tier) {
  // Update .github/self-heal-schedule.yml
  let doc = {
    schedule: newSchedule,
    rationale: `Computed based on telemetry (tier: ${tier}).`
  };

  let yamlStr = yaml.dump(doc);
  yamlStr = yamlStr.replace(/^schedule:.*$/m, (match) => `${match} # AUTO-UPDATED`);
  fs.writeFileSync(scheduleFilePath, yamlStr, 'utf8');
  console.log(`Updated schedule file to: ${newSchedule}`);

  // Update .github/workflows/self-heal.yml
  try {
    const workflowContent = fs.readFileSync(workflowFilePath, 'utf8');
    const parsedWorkflow = yaml.load(workflowContent);
    if (parsedWorkflow && parsedWorkflow.on && parsedWorkflow.on.schedule) {
       parsedWorkflow.on.schedule[0].cron = newSchedule;
       let updatedWorkflowContent = yaml.dump(parsedWorkflow);
       updatedWorkflowContent = updatedWorkflowContent.replace(/^(\s*- cron:.*)$/m, (match) => `${match} # AUTO-UPDATED`);
       fs.writeFileSync(workflowFilePath, updatedWorkflowContent, 'utf8');
       console.log('Updated workflow file successfully using js-yaml.');
    }
  } catch(e) {
    console.log('Failed to parse or update workflow file using js-yaml:', e);
  }
}

function main() {
  console.log('Computing new schedule...');
  const telemetry = getTelemetry();
  const { schedule, tier } = computeSchedule(telemetry);

  console.log(`Computed schedule: ${schedule} (Tier: ${tier})`);

  let currentSchedule = '';
  try {
    const currentYaml = fs.readFileSync(scheduleFilePath, 'utf8');
    const parsed = yaml.load(currentYaml);
    if (parsed && parsed.schedule) {
      currentSchedule = parsed.schedule;
    }
  } catch (e) {
    console.log('No existing schedule file found or parse error.');
  }

  if (schedule !== currentSchedule) {
    updateScheduleFiles(schedule, tier);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule_changed=true\n`);
    } else {
      console.log('schedule_changed=true');
    }
  } else {
    console.log('Schedule unchanged. No update needed.');
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule_changed=false\n`);
    } else {
      console.log('schedule_changed=false');
    }
  }
}

main();
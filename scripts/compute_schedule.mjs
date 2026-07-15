#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import process from 'process';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';

function runCommand(command) {
  try {
    return execSync(command, { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return null;
  }
}

function computeSchedule() {
  // Use gh to get telemetry data if available
  let mergedCount = 0;

  try {
    const prOutput = runCommand('gh pr list --state merged --json mergedAt -L 50');
    if (prOutput) {
      const prs = JSON.parse(prOutput);
      mergedCount = prs.length;
    }
  } catch (e) {
    console.log('Failed to fetch PR telemetry, using fallback defaults.');
  }

  let schedule = '0 3 * * *'; // Default: once a day at 3 AM
  let rationale = 'Default schedule';

  if (mergedCount > 20) {
    schedule = '0 */6 * * *'; // Every 6 hours
    rationale = 'High PR velocity';
  } else if (mergedCount > 10) {
    schedule = '0 */12 * * *'; // Every 12 hours
    rationale = 'Active PR velocity';
  } else if (mergedCount > 0) {
    schedule = '0 3 * * *'; // Once a day
    rationale = 'Standard PR velocity';
  } else {
    schedule = '0 3 * * 1'; // Once a week
    rationale = 'Low churn / dormant';
  }

  return { schedule, rationale };
}

function updateSchedule() {
  let currentState = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      currentState = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || {};
    } catch (e) {
      console.error('Failed to parse current schedule file:', e);
    }
  }

  // Oscillation guard: only update if it has been more than 1 week since last update
  if (currentState.last_updated) {
    const lastUpdated = new Date(currentState.last_updated);
    const now = new Date();
    const diffDays = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      console.log('Schedule updated recently, skipping recomputation.');
      return;
    }
  }

  const { schedule, rationale } = computeSchedule();

  if (currentState.schedule === schedule) {
    console.log('Schedule unchanged.');
    return;
  }

  const newState = {
    schedule,
    rationale,
    last_updated: new Date().toISOString()
  };

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newState));
  console.log(`Updated schedule to: ${schedule} (${rationale})`);

  // Also update the actual GitHub Action workflow file
  const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    workflowContent = workflowContent.replace(/cron:\s*['"].*['"]\s*# AUTO-UPDATED/, `cron: '${schedule}' # AUTO-UPDATED`);
    fs.writeFileSync(WORKFLOW_FILE, workflowContent);
    console.log(`Updated cron expression in ${WORKFLOW_FILE}`);
  }
}

updateSchedule();

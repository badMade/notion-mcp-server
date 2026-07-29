#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = path.join('.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join('.github', 'workflows', 'self-heal.yml');

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
}

function computeSchedule() {
  // Telemetry fallback defaults
  let commitCount = 10;

  const history = runCmd('git rev-list --count --since="7 days ago" HEAD');
  if (history && parseInt(history, 10) > 0) {
    // Basic approximation: more commits -> higher churn -> higher frequency
    const commits = parseInt(history, 10);
    commitCount = commits;
  }

  console.log(`[Compute] Found ${commitCount} commits`);

  let schedule = '0 0 * * *'; // default: daily
  let rationale = 'Default low-churn cadence';

  if (commitCount > 100) {
    schedule = '0 */6 * * *';
    rationale = 'High velocity detected, running every 6 hours';
  } else if (commitCount > 50) {
    schedule = '0 */12 * * *';
    rationale = 'Active velocity detected, running every 12 hours';
  } else if (commitCount > 10) {
    schedule = '0 0 * * *';
    rationale = 'Standard velocity detected, running daily';
  } else {
    schedule = '0 0 * * 0';
    rationale = 'Dormant repository, running weekly';
  }

  return { schedule, rationale };
}

function readCurrentSchedule() {
  try {
    const content = readFileSync(SCHEDULE_FILE, 'utf8');
    const data = yaml.load(content);
    return data || {};
  } catch (err) {
    return {};
  }
}

function writeSchedule(data) {
  const yamlContent = yaml.dump(data, { forceQuotes: true });
  writeFileSync(SCHEDULE_FILE, yamlContent, 'utf8');
}

function updateWorkflow(newSchedule) {
  try {
    const workflowContent = readFileSync(WORKFLOW_FILE, 'utf8');
    // Using simple sed-like replacement via regex targeting the exact marker
    const updatedContent = workflowContent.replace(
      /cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g,
      `cron: '${newSchedule}' # AUTO-UPDATED`
    );
    writeFileSync(WORKFLOW_FILE, updatedContent, 'utf8');
    return true;
  } catch (err) {
    console.error('[Compute] Failed to update workflow file:', err.message);
    return false;
  }
}

function main() {
  console.log('[Compute] Evaluating schedule...');

  const currentData = readCurrentSchedule();

  // Guard against oscillation
  if (currentData.LAST_UPDATED) {
    const lastUpdateDate = new Date(currentData.LAST_UPDATED);
    const now = new Date();
    const diffDays = (now - lastUpdateDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 3) {
      console.log('[Compute] Schedule updated recently. Skipping recompute to avoid oscillation.');
      process.exit(0);
    }
  }

  const { schedule: newSchedule, rationale } = computeSchedule();
  console.log(`[Compute] Computed schedule: ${newSchedule}`);
  console.log(`[Compute] Rationale: ${rationale}`);

  if (currentData.SELFHEAL_SCHEDULE === newSchedule) {
    console.log('[Compute] Schedule unchanged. No action needed.');
    process.exit(0);
  }

  console.log('[Compute] Schedule changed! Updating config...');
  const newData = {
    SELFHEAL_SCHEDULE: newSchedule,
    RATIONALE: rationale,
    LAST_UPDATED: new Date().toISOString()
  };

  writeSchedule(newData);
  updateWorkflow(newSchedule);

  console.log('[Compute] Success.');
}

main();

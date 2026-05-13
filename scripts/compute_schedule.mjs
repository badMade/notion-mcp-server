#!/usr/bin/env node

/**
 * compute_schedule.mjs
 * Analyzes repository telemetry (commits/PRs) to compute an optimal
 * self-heal schedule, then updates .github/self-heal-schedule.yml
 * and .github/workflows/self-heal.yml.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SCHEDULE_FILE = path.join(projectRoot, '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(projectRoot, '.github', 'workflows', 'self-heal.yml');

function getRecentCommitsCount() {
  try {
    // Last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().split('T')[0];

    const output = execSync(`git log --since="${sinceStr}" --oneline`, { cwd: projectRoot, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean).length;
  } catch (err) {
    console.warn('[ComputeSchedule] Warning: Failed to get recent commits', err);
    return 10; // Fallback
  }
}

function computeCadenceTier(commitsCount) {
  if (commitsCount > 100) return 'high';
  if (commitsCount > 50) return 'active';
  if (commitsCount > 10) return 'standard';
  if (commitsCount > 0) return 'low-churn';
  return 'dormant';
}

function getCronForTier(tier) {
  // Using simplified general crons rather than strict time-of-day math for robustness
  switch (tier) {
    case 'high':      return '0 */4 * * *'; // Every 4 hours
    case 'active':    return '0 */8 * * *'; // Every 8 hours
    case 'standard':  return '0 0 * * *';   // Daily at midnight
    case 'low-churn': return '0 0 * * 0';   // Weekly on Sunday
    case 'dormant':   return '0 0 1 * *';   // Monthly on the 1st
    default:          return '0 0 * * *';   // Fallback daily
  }
}

function updateYamlFiles(newCron, rationale) {
  console.log(`[ComputeSchedule] Updating schedule to: ${newCron}`);

  // 1. Update self-heal-schedule.yml using js-yaml
  const scheduleData = {
    schedule: newCron,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData) + '\n# AUTO-UPDATED\n');

  // 2. Update workflows/self-heal.yml using js-yaml for structural safety,
  // falling back to regex replacement if we want to preserve comments.
  // GitHub Action workflow files often have complex structure, let's use regex
  // anchored by the marker or specific path.
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf-8');

    // We will find the schedule block and update it.
    // The safest way is to regex match the specific cron line if we mark it.
    const cronRegex = /cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g;

    if (cronRegex.test(workflowContent)) {
      workflowContent = workflowContent.replace(cronRegex, `cron: '${newCron}' # AUTO-UPDATED`);
      // Parse with js-yaml to validate the string is still valid YAML
      try {
        yaml.load(workflowContent);
        fs.writeFileSync(WORKFLOW_FILE, workflowContent);
      } catch (err) {
        console.error('[ComputeSchedule] Error validating mutated workflow YAML. Aborting update.', err);
      }
    } else {
      console.warn('[ComputeSchedule] Warning: Could not find `# AUTO-UPDATED` cron marker in self-heal.yml');
    }
  }
}

function main() {
  console.log('[ComputeSchedule] Computing schedule based on telemetry...');

  const commitCount = getRecentCommitsCount();
  const tier = computeCadenceTier(commitCount);
  const newCron = getCronForTier(tier);
  const rationale = `Computed tier '${tier}' based on ${commitCount} commits in the last 30 days.`;

  console.log(`[ComputeSchedule] ${rationale}`);

  updateYamlFiles(newCron, rationale);

  console.log('[ComputeSchedule] Done.');
}

main();

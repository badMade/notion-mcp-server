#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

function getPRVelocity() {
  try {
    // Get recent merged PRs in the last 30 days
    const date30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cmd = `gh pr list --state merged --json mergedAt --search "merged:>=${date30DaysAgo}"`;
    const result = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    const prs = JSON.parse(result);
    return prs.length;
  } catch (e) {
    console.error('Failed to get PR velocity from gh cli, fallback to default.');
    return null;
  }
}

function getCommitVelocity() {
  try {
    const cmd = `git log --since="30 days ago" --oneline | wc -l`;
    const result = execSync(cmd).toString().trim();
    return parseInt(result, 10);
  } catch (e) {
    return null;
  }
}

// Telemetry Logic
let mergedPrs = getPRVelocity();
if (mergedPrs === null) {
  const commitCount = getCommitVelocity() || 10;
  // Approximation if gh is unavailable
  mergedPrs = Math.floor(commitCount / 3);
}

let tier = 'standard';
let cron = '0 3 * * 1-5'; // default fallback
let rationale = 'Default standard schedule based on fallback logic.';

if (mergedPrs > 20) {
  tier = 'high';
  cron = '0 */6 * * *';
  rationale = `High PR velocity (${mergedPrs} PRs/mo). Scheduling multiple runs per day.`;
} else if (mergedPrs > 10) {
  tier = 'active';
  cron = '0 */12 * * *';
  rationale = `Active PR velocity (${mergedPrs} PRs/mo). Scheduling frequent runs.`;
} else if (mergedPrs > 5) {
  tier = 'standard';
  cron = '0 3 * * *';
  rationale = `Standard PR velocity (${mergedPrs} PRs/mo). Scheduling daily runs.`;
} else if (mergedPrs > 0) {
  tier = 'low-churn';
  cron = '0 3 * * 1';
  rationale = `Low PR velocity (${mergedPrs} PRs/mo). Scheduling weekly runs.`;
} else {
  tier = 'dormant';
  cron = '0 3 1 * *';
  rationale = `Dormant PR velocity (0 PRs/mo). Scheduling monthly runs.`;
}

console.log(`Computed tier: ${tier}`);
console.log(`Computed cron: ${cron}`);
console.log(`Rationale: ${rationale}`);

const scheduleConfigPath = '.github/self-heal-schedule.yml';
const workflowPath = '.github/workflows/self-heal.yml';

// Write schedule file
const scheduleData = {
  schedule: cron,
  tier: tier,
  rationale: rationale,
  lastUpdated: new Date().toISOString()
};

writeFileSync(scheduleConfigPath, yaml.dump(scheduleData));
console.log(`Updated ${scheduleConfigPath}`);

// Try to update workflow if it exists
if (existsSync(workflowPath)) {
  let workflowContent = readFileSync(workflowPath, 'utf8');
  // Use regex to replace the schedule, keeping the # AUTO-UPDATED marker
  const updatedContent = workflowContent.replace(/cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED/g, `cron: '${cron}' # AUTO-UPDATED`);

  if (workflowContent !== updatedContent) {
    // Validate YAML before writing
    try {
      yaml.load(updatedContent);
      writeFileSync(workflowPath, updatedContent);
      console.log(`Updated schedule in ${workflowPath}`);
    } catch (e) {
      console.error('Failed to parse updated workflow YAML. Skipping update.');
      process.exit(1);
    }
  } else {
    console.log(`No schedule change needed in ${workflowPath}`);
  }
} else {
  console.log(`${workflowPath} does not exist yet. Run this again after it's created.`);
}

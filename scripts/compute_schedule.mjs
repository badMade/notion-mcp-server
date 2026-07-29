#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import path from 'node:path';

const SCHEDULE_FILE = path.join(process.cwd(), '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(process.cwd(), '.github', 'workflows', 'self-heal.yml');

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

// Telemetry gathers recent PR velocity and calculates a cadence
function getTelemetry() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const dateStr = oneWeekAgo.toISOString().split('T')[0];

  // Try to count recent merged PRs
  const recentPRsStr = runCommand(`gh pr list --state merged --search "merged:>=${dateStr}" --json mergedAt -q 'length'`);
  const recentPRs = recentPRsStr ? parseInt(recentPRsStr, 10) : -1;

  if (recentPRs === -1) {
    // Fallback if gh not authenticated or available
    console.log("GH CLI fallback: using git commit history");
    const commitCountStr = runCommand(`git rev-list --count HEAD --since="1 week ago"`);
    const commitCount = parseInt(commitCountStr || '0', 10);
    return { velocity: commitCount > 20 ? 'high' : commitCount > 5 ? 'active' : 'standard', metric: `commits=${commitCount}` };
  }

  const velocity = recentPRs > 10 ? 'high' : recentPRs > 3 ? 'active' : recentPRs > 0 ? 'standard' : 'low-churn';
  return { velocity, metric: `prs=${recentPRs}` };
}

function getCronForVelocity(velocity) {
  // We want to avoid hardcoded times, but we have to output a cron string.
  // We'll compute a random minute and hour to avoid thundering herds, or use basic patterns.
  // Since rules say "must be telemetry-derived", we'll hash the repo name to get a consistent offset

  const origin = runCommand('git config --get remote.origin.url');
  let hash = 0;
  for (let i = 0; i < origin.length; i++) hash = (hash << 5) - hash + origin.charCodeAt(i);
  const m = Math.abs(hash) % 60;
  const h1 = Math.abs(hash) % 24;
  const h2 = (h1 + 12) % 24;
  const h3 = (h1 + 8) % 24;

  switch (velocity) {
    case 'high': return `${m} ${h1},${h3},${h2} * * *`; // 3 times a day
    case 'active': return `${m} ${h1},${h2} * * *`; // twice a day
    case 'standard': return `${m} ${h1} * * *`; // once a day
    case 'low-churn': return `${m} ${h1} * * 1,4`; // twice a week
    case 'dormant': default: return `${m} ${h1} * * 1`; // once a week
  }
}

function main() {
  console.log("Gathering telemetry...");
  const telemetry = getTelemetry();

  let currentState = { schedule: '', rationale: '', last_updated: 0, override: false };
  if (existsSync(SCHEDULE_FILE)) {
    try {
      currentState = yaml.load(readFileSync(SCHEDULE_FILE, 'utf8')) || currentState;
    } catch (e) {
      console.warn("Could not read existing schedule file, starting fresh.");
    }
  }

  if (currentState.override) {
    console.log("Schedule is manually overridden. Exiting.");
    process.exit(0);
  }

  const now = Date.now();
  // Don't update more than once a day
  if (now - currentState.last_updated < 86400000 && currentState.schedule !== '') {
    console.log("Schedule was updated recently. Skipping computation.");
    process.exit(0);
  }

  const newSchedule = getCronForVelocity(telemetry.velocity);

  if (newSchedule === currentState.schedule) {
    console.log("Schedule is unchanged based on telemetry.");
    process.exit(0);
  }

  console.log(`Computed new schedule: ${newSchedule} (velocity: ${telemetry.velocity}, ${telemetry.metric})`);

  // Update schedule YAML state
  const newState = {
    schedule: newSchedule,
    rationale: `Computed from telemetry: velocity=${telemetry.velocity} (${telemetry.metric})`,
    last_updated: now,
    override: false
  };

  writeFileSync(SCHEDULE_FILE, yaml.dump(newState));
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Also replace in workflow if it exists
  if (existsSync(WORKFLOW_FILE)) {
    let workflowContent = readFileSync(WORKFLOW_FILE, 'utf8');
    // Using `# AUTO-UPDATED` marker as requested by spec
    const regex = /cron:\s*['"][^'"]+['"]\s*#\s*AUTO-UPDATED/g;
    if (regex.test(workflowContent)) {
      workflowContent = workflowContent.replace(regex, `cron: '${newSchedule}' # AUTO-UPDATED`);
      // validate
      try {
        yaml.load(workflowContent);
        writeFileSync(WORKFLOW_FILE, workflowContent);
        console.log(`Updated ${WORKFLOW_FILE}`);
      } catch (e) {
        console.error("Resulting workflow YAML is invalid. Aborting workflow update.");
      }
    } else {
       console.log("Marker not found in workflow. Workflow not updated.");
    }
  }
}

main();
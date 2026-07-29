#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Computes an optimal GitHub Actions cron schedule based on recent CI and PR telemetry.
 * Updates .github/workflows/self-heal.yml and .github/self-heal-schedule.yml.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// Constants
const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function runGhCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Failed gh command: ${command}`);
    return null;
  }
}

function computeTelemetry() {
  // If no GH_TOKEN or running locally without gh cli, provide fallback telemetry
  try {
    execSync('gh auth status', { stdio: 'ignore' });
  } catch (e) {
    console.log('GitHub CLI not authenticated or available, using fallback telemetry.');
    return { prVelocity: 'standard' };
  }

  // Get merged PRs in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const prsResult = runGhCommand(`gh pr list --state merged --search "merged:>=${sevenDaysAgo}" --json mergedAt`);

  let prCount = 0;
  if (prsResult) {
    try {
      const prs = JSON.parse(prsResult);
      prCount = prs.length;
    } catch (e) {}
  }

  // Simplified velocity thresholds
  let velocity = 'standard';
  if (prCount > 20) velocity = 'high';
  else if (prCount > 5) velocity = 'active';
  else if (prCount === 0) velocity = 'dormant';

  return { prVelocity: velocity };
}

function getScheduleForVelocity(velocity) {
  switch (velocity) {
    case 'high': return "0 */6 * * *"; // Every 6 hours
    case 'active': return "0 */12 * * *"; // Every 12 hours
    case 'standard': return "0 0 * * *"; // Daily
    case 'low-churn': return "0 0 * * 1"; // Weekly
    case 'dormant': return "0 0 1 * *"; // Monthly
    default: return "0 0 * * *";
  }
}

async function main() {
  console.log('Computing new schedule based on telemetry...');

  let currentScheduleData = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      currentScheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8')) || {};
    } catch (e) {
      console.warn(`Could not parse ${SCHEDULE_FILE}, starting fresh.`);
    }
  }

  const lastUpdated = currentScheduleData.LAST_UPDATED ? new Date(currentScheduleData.LAST_UPDATED).getTime() : 0;
  const now = Date.now();

  // Oscillation Guard
  if (now - lastUpdated < MIN_UPDATE_INTERVAL_MS) {
    console.log('Schedule was updated recently (less than 3 days ago). Skipping recompute to avoid thrashing.');
    process.exit(0);
  }

  const telemetry = computeTelemetry();
  const newSchedule = getScheduleForVelocity(telemetry.prVelocity);

  if (currentScheduleData.SCHEDULE === newSchedule) {
    console.log('Schedule is unchanged. Skipping update.');
    process.exit(0);
  }

  console.log(`New schedule computed: ${newSchedule} (velocity: ${telemetry.prVelocity})`);

  // Update .github/self-heal-schedule.yml
  const newScheduleData = {
    SCHEDULE: newSchedule,
    RATIONALE: `Computed based on PR velocity: ${telemetry.prVelocity}`,
    LAST_UPDATED: new Date(now).toISOString()
  };

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newScheduleData, { forceQuotes: true }));
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Update .github/workflows/self-heal.yml
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');

    // We update the line with the specific `# AUTO-UPDATED` marker
    const lines = workflowContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('# AUTO-UPDATED')) {
        // e.g., "    - cron: '0 0 * * *' # AUTO-UPDATED"
        const indentMatch = lines[i].match(/^(\s*- cron:\s*)/);
        const indent = indentMatch ? indentMatch[1] : '    - cron: ';
        lines[i] = `${indent}'${newSchedule}' # AUTO-UPDATED`;
      }
    }

    // Ensure we can still parse it with js-yaml safely
    const updatedYaml = lines.join('\n');
    try {
      yaml.load(updatedYaml); // Validate
      fs.writeFileSync(WORKFLOW_FILE, updatedYaml);
      console.log(`Updated ${WORKFLOW_FILE}`);
    } catch (e) {
      console.error(`Failed to validate updated workflow YAML: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.warn(`${WORKFLOW_FILE} does not exist yet. It will be created later in the self-heal setup.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

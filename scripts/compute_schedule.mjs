#!/usr/bin/env node

/**
 * Compute Schedule Script
 * Analyzes telemetry to identify schedule expression and saves to `.github/self-heal-schedule.yml`
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
const OSCILLATION_GUARD_DAYS = 3;

const runCommand = (command) => {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
};

const getPRVelocity = () => {
    // Attempt to get merged PRs in the last 30 days
    // Fallback if gh not available or no PRs
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const output = runCommand(`gh pr list --state merged --search "merged:>=${thirtyDaysAgo}" --json mergedAt`);
        if (output) {
            const prs = JSON.parse(output);
            return prs.length;
        }
    } catch (e) {
        // Fallback to commit count if gh fails
    }

    try {
        const output = runCommand('git log --since="30 days ago" --oneline | wc -l');
        return parseInt(output.trim(), 10) || 0;
    } catch (e) {
        return 0;
    }
};

const getCommitHours = () => {
  const output = runCommand('git log --format="%aI"');
  if (!output) return [];
  const hours = new Array(24).fill(0);
  output.split('\n').forEach(dateStr => {
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
         hours[date.getUTCHours()]++;
      }
    }
  });
  return hours;
};

const main = () => {
  console.log('--- Computing Schedule ---');

  let lastUpdated = 0;
  let consecutiveEmptyRuns = 0;
  let consecutiveSuccessfulPRs = 0;
  let userOverride = false;

  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const currentConfig = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      if (currentConfig && currentConfig.LAST_UPDATED) {
         lastUpdated = new Date(currentConfig.LAST_UPDATED).getTime();
      }
      consecutiveEmptyRuns = currentConfig.CONSECUTIVE_EMPTY_RUNS || 0;
      consecutiveSuccessfulPRs = currentConfig.CONSECUTIVE_SUCCESSFUL_PRS || 0;
      userOverride = currentConfig.USER_OVERRIDE || false;
    } catch (err) {}
  }

  if (userOverride) {
      console.log('User override detected. Skipping schedule computation.');
      process.exit(0);
  }

  const now = Date.now();
  const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);

  // Read selfheal PR success rate (telemetry)
  try {
      // Find recent selfheal PRs
      const prData = runCommand('gh pr list --label self-heal --state merged --limit 5 --json state');
      if (prData) {
          const prs = JSON.parse(prData);
          consecutiveSuccessfulPRs = prs.filter(pr => pr.state === 'MERGED').length;
      }
  } catch (e) {}

  if (lastUpdated > 0 && daysSinceUpdate < OSCILLATION_GUARD_DAYS && consecutiveEmptyRuns < 3 && consecutiveSuccessfulPRs < 3) {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago (less than ${OSCILLATION_GUARD_DAYS}) and no adjustment triggers met. Skipping recompute.`);
    process.exit(0); // Exit gracefully to prevent thrashing
  }

  const prVelocity = getPRVelocity();
  const commitHours = getCommitHours();

  let quietestHour = 0;
  let minCommits = Infinity;

  // Active-period detection
  if (commitHours.length > 0) {
      for (let i = 0; i < 24; i++) {
        if (commitHours[i] < minCommits) {
          minCommits = commitHours[i];
          quietestHour = i;
        }
      }
  }

  // Cadence tiers
  let cadenceTier = 'standard';
  let cronExp = `0 ${quietestHour} * * *`; // Default standard

  if (prVelocity > 50) {
      cadenceTier = 'high';
      cronExp = `0 */8 * * *`; // 3 times a day
  } else if (prVelocity > 20) {
      cadenceTier = 'active';
      cronExp = `0 */12 * * *`; // Twice a day
  } else if (prVelocity > 5) {
      cadenceTier = 'standard';
      cronExp = `0 ${quietestHour} * * *`; // Daily
  } else if (prVelocity > 0) {
      cadenceTier = 'low-churn';
      cronExp = `0 ${quietestHour} * * 0,3`; // Twice a week
  } else {
      cadenceTier = 'dormant';
      cronExp = `0 ${quietestHour} * * 0`; // Weekly
  }

  // Adjustment triggers
  if (consecutiveEmptyRuns >= 3) {
      console.log('3+ consecutive empty runs detected. Decreasing frequency.');
      if (cadenceTier === 'high') cronExp = `0 */12 * * *`;
      else if (cadenceTier === 'active') cronExp = `0 ${quietestHour} * * *`;
      else if (cadenceTier === 'standard') cronExp = `0 ${quietestHour} * * 0,3`;
      else if (cadenceTier === 'low-churn') cronExp = `0 ${quietestHour} * * 0`;

      consecutiveEmptyRuns = 0; // Reset
  } else if (consecutiveSuccessfulPRs >= 3) {
      console.log('3+ consecutive successful PRs detected. Increasing frequency.');
      if (cadenceTier === 'dormant') cronExp = `0 ${quietestHour} * * 0,3`;
      else if (cadenceTier === 'low-churn') cronExp = `0 ${quietestHour} * * *`;
      else if (cadenceTier === 'standard') cronExp = `0 */12 * * *`;
      else if (cadenceTier === 'active') cronExp = `0 */8 * * *`;

      consecutiveSuccessfulPRs = 0; // Reset
  }

  console.log(`Computed optimal cron: ${cronExp} (Tier: ${cadenceTier}, Velocity: ${prVelocity})`);

  const rationale = `Based on PR velocity (${prVelocity} recent), tier is ${cadenceTier}. Quietest hour UTC: ${quietestHour}.`;
  const config = {
    SELFHEAL_SCHEDULE: cronExp,
    RATIONALE: rationale,
    LAST_UPDATED: new Date(now).toISOString(),
    CONSECUTIVE_EMPTY_RUNS: consecutiveEmptyRuns,
    CONSECUTIVE_SUCCESSFUL_PRS: consecutiveSuccessfulPRs,
    USER_OVERRIDE: false
  };

  if (!fs.existsSync(path.dirname(SCHEDULE_FILE))) {
     fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  }

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(config, { forceQuotes: true }));
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Also update self-heal.yml inline if it exists
  if (fs.existsSync(WORKFLOW_FILE)) {
     let workflow = fs.readFileSync(WORKFLOW_FILE, 'utf8');
     // Replace schedule line using marker
     workflow = workflow.replace(/cron: ["'].+["'] # AUTO-UPDATED/g, `cron: "${cronExp}" # AUTO-UPDATED`);
     fs.writeFileSync(WORKFLOW_FILE, workflow);
     console.log(`Updated ${WORKFLOW_FILE} inline cron.`);
  } else {
     console.log(`Workflow file ${WORKFLOW_FILE} not found. Skipping inline update.`);
  }

  process.exit(0);
};

main();

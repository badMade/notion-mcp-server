#!/usr/bin/env node

/**
 * Computes optimal self-healing schedule based on telemetry (commits/PRs).
 * Generates a standard cron string dynamically.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const RUN_ON_ERRORS = true; // Still output fallback if API calls fail

const execSafe = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    if (RUN_ON_ERRORS) return fallback;
    throw error;
  }
};

const getCommitCount = (days) => {
  const dateStr = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const countStr = execSafe(`git rev-list --count HEAD --since="${dateStr}"`, '10');
  return parseInt(countStr, 10) || 0;
};

const getRecentSelfHealRuns = () => {
  const prs = execSafe(`gh pr list --label self-heal --state all --limit 10 --json state,createdAt`, '[]');
  try {
    return JSON.parse(prs);
  } catch (e) {
    return [];
  }
};

const computeCadence = () => {
  const commitCount30d = getCommitCount(30);
  console.log(`[Compute] Commits in last 30 days: ${commitCount30d}`);

  let tier = 'standard';
  let cron = '0 3 * * 1,4'; // Default: 3AM on Mon/Thu

  if (commitCount30d > 50) {
    tier = 'high';
    cron = '0 */12 * * *'; // Every 12 hours
  } else if (commitCount30d > 20) {
    tier = 'active';
    cron = '0 0 * * *'; // Daily at midnight
  } else if (commitCount30d < 5) {
    tier = 'dormant';
    cron = '0 0 1 * *'; // Monthly
  }

  // Check recent runs for adjustments
  const recentRuns = getRecentSelfHealRuns();
  if (recentRuns.length >= 3) {
    const last3 = recentRuns.slice(0, 3);
    const allMerged = last3.every(pr => pr.state === 'MERGED');
    const allClosed = last3.every(pr => pr.state === 'CLOSED');

    if (allMerged && tier !== 'high') {
       console.log('[Compute] 3+ successful PRs recently, increasing frequency.');
       cron = tier === 'active' ? '0 */12 * * *' : (tier === 'standard' ? '0 0 * * *' : '0 3 * * 1,4');
       tier = tier === 'active' ? 'high' : (tier === 'standard' ? 'active' : 'standard');
    } else if (allClosed && tier !== 'dormant') {
       console.log('[Compute] 3+ empty/closed runs recently, decreasing frequency.');
       cron = tier === 'standard' ? '0 0 1 * *' : '0 3 * * 1,4';
       tier = tier === 'standard' ? 'dormant' : 'standard';
    }
  }

  return { tier, cron, commitCount30d };
};

const main = () => {
  console.log('[Compute] Analyzing repository telemetry...');

  // Telemetry extraction
  const { tier, cron, commitCount30d } = computeCadence();

  console.log(`[Compute] Computed Tier: ${tier}`);
  console.log(`[Compute] Computed Cron: ${cron}`);

  const scheduleConfigPath = join(process.cwd(), '.github', 'self-heal-schedule.yml');
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'self-heal.yml');

  // Oscillation Guard
  try {
    const currentConfigStr = readFileSync(scheduleConfigPath, 'utf8');
    const currentConfig = yaml.load(currentConfigStr);
    if (currentConfig.cron === cron) {
      console.log('[Compute] Schedule unchanged. Exiting.');
      return;
    }

    // Check if updated recently (e.g., within last 2 days)
    if (currentConfig.last_updated) {
       const lastUpdate = new Date(currentConfig.last_updated);
       if ((Date.now() - lastUpdate.getTime()) < 2 * 24 * 60 * 60 * 1000) {
           console.log('[Compute] Schedule was updated too recently. Skipping to avoid oscillation.');
           return;
       }
    }
  } catch (e) {
    // Config doesn't exist or is invalid, proceed
    console.log('[Compute] No existing schedule config found or error reading it. Proceeding.');
  }

  // Update schedule config file
  const newConfig = {
    cron,
    tier,
    commit_count_30d: commitCount30d,
    rationale: `Computed based on ${commitCount30d} commits in the last 30 days. Tier: ${tier}`,
    last_updated: new Date().toISOString()
  };

  const yamlStr = yaml.dump(newConfig);
  writeFileSync(scheduleConfigPath, yamlStr, 'utf8');
  console.log(`[Compute] Updated ${scheduleConfigPath}`);

  // Safely update the workflow file using regex on the specific line with marker
  try {
    let workflowContent = readFileSync(workflowPath, 'utf8');
    // Replace the cron schedule line that has the `# AUTO-UPDATED` marker
    workflowContent = workflowContent.replace(/cron:\s*['"]?.*?['"]?\s*# AUTO-UPDATED/, `cron: '${cron}' # AUTO-UPDATED`);

    // Validate workflow remains valid YAML
    yaml.load(workflowContent);
    writeFileSync(workflowPath, workflowContent, 'utf8');
    console.log(`[Compute] Updated cron expression in ${workflowPath}`);
  } catch (e) {
    console.warn(`[Compute] Could not update workflow file. It may not exist yet or is invalid YAML. Error: ${e.message}`);
  }
};

main();

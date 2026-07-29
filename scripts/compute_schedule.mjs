#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(REPO_ROOT, '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(REPO_ROOT, '.github', 'workflows', 'self-heal.yml');

// Settings
const LOOKBACK_DAYS = 14;
const OSCILLATION_GUARD_DAYS = 3;

function runGhCommand(command) {
  try {
    const output = execSync(command, { encoding: 'utf8' }).trim();
    if (output === '') return [];
    return JSON.parse(output);
  } catch (error) {
    console.error(`Error running gh command: ${command}`);
    return [];
  }
}

function computeMetrics() {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceStr = since.toISOString().split('T')[0];

  // 1. PR velocity (merged PRs in last N days)
  const prs = runGhCommand(`gh pr list --state merged --search "merged:>=${sinceStr}" --json mergedAt`);
  const prVelocity = prs.length;

  // 2. CI failure rate (failed CI runs in last N days)
  const ciRuns = runGhCommand(`gh run list --workflow=ci --created ">=${sinceStr}" --json conclusion`);
  const failedRuns = ciRuns.filter(r => r.conclusion === 'failure').length;

  // 3. Self-heal success rate
  const selfHealPrs = runGhCommand(`gh pr list --label self-heal --search "created:>=${sinceStr}" --json state,createdAt`);
  const mergedSelfHeals = selfHealPrs.filter(pr => pr.state === 'MERGED').length;
  const recentEmptyRuns = runGhCommand(`gh run list --workflow=self-heal --created ">=${sinceStr}" --json conclusion`)
                             .filter(r => r.conclusion === 'success' && !selfHealPrs.find(pr => new Date(pr.createdAt) > new Date(r.createdAt)));

  return { prVelocity, failedRuns, mergedSelfHeals, emptyRuns: recentEmptyRuns.length };
}

function determineTier(metrics, currentTier) {
  let initialTier;

  if (metrics.prVelocity > 10) initialTier = 'high';
  else if (metrics.prVelocity > 5) initialTier = 'active';
  else if (metrics.prVelocity > 1) initialTier = 'standard';
  else if (metrics.prVelocity === 1) initialTier = 'low-churn';
  else initialTier = 'dormant';

  // Adjustments based on telemetry
  const tiers = ['dormant', 'low-churn', 'standard', 'active', 'high'];
  let tierIdx = tiers.indexOf(initialTier);

  if (metrics.emptyRuns >= 3) {
    tierIdx = Math.max(0, tierIdx - 1);
  } else if (metrics.mergedSelfHeals >= 3) {
    tierIdx = Math.min(tiers.length - 1, tierIdx + 1);
  }

  return tiers[tierIdx];
}

function getCronForTier(tier) {
  switch (tier) {
    case 'high': return '0 */6 * * *'; // Every 6 hours
    case 'active': return '0 */12 * * *'; // Every 12 hours
    case 'standard': return '0 0 * * *'; // Daily at midnight
    case 'low-churn': return '0 0 * * 1,4'; // Monday and Thursday
    case 'dormant': return '0 0 * * 1'; // Weekly on Monday
    default: return '0 0 * * *';
  }
}

function main() {
  console.log('--- Starting Schedule Computation ---');

  let currentConfig = { tier: 'standard', schedule: '0 0 * * *', last_updated: new Date(0).toISOString() };
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const fileContent = fs.readFileSync(SCHEDULE_FILE, 'utf8');
      currentConfig = yaml.load(fileContent) || currentConfig;
    } catch (e) {
      console.warn('Could not parse existing schedule file. Using defaults.');
    }
  }

  const lastUpdated = new Date(currentConfig.last_updated || 0);
  const daysSinceUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < OSCILLATION_GUARD_DAYS && process.env.FORCE_UPDATE !== 'true') {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago (less than ${OSCILLATION_GUARD_DAYS} days threshold). Skipping recomputation.`);
    process.exit(0);
  }

  const metrics = computeMetrics();
  console.log('Telemetry Metrics:', metrics);

  const newTier = determineTier(metrics, currentConfig.tier);
  const newSchedule = getCronForTier(newTier);

  console.log(`Current Tier: ${currentConfig.tier}, New Tier: ${newTier}`);
  console.log(`Current Schedule: ${currentConfig.schedule}, New Schedule: ${newSchedule}`);

  if (currentConfig.schedule === newSchedule && process.env.FORCE_UPDATE !== 'true') {
    console.log('Schedule unchanged. No update needed.');
    process.exit(0);
  }

  const updatedConfig = {
    schedule: newSchedule,
    tier: newTier,
    last_updated: new Date().toISOString(),
    rationale: `Computed based on PR velocity: ${metrics.prVelocity}, CI Failures: ${metrics.failedRuns}, Recent empty runs: ${metrics.emptyRuns}`
  };

  const yamlStr = yaml.dump(updatedConfig, { forceQuotes: true });
  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, yamlStr);
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Update the workflow file using regex replacement with # AUTO-UPDATED marker
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    const cronRegex = /(cron:\s*)(['"]?[\d*/,-\s]+['"]?)(\s*#\s*AUTO-UPDATED)/;

    if (cronRegex.test(workflowContent)) {
      workflowContent = workflowContent.replace(cronRegex, `$1"${newSchedule}"$3`);
      fs.writeFileSync(WORKFLOW_FILE, workflowContent);
      console.log(`Updated schedule in ${WORKFLOW_FILE}`);
    } else {
      console.warn(`Could not find the # AUTO-UPDATED marker in ${WORKFLOW_FILE}. Make sure the cron line has this marker.`);
    }
  } else {
    console.warn(`${WORKFLOW_FILE} does not exist yet. Ensure it has the marker when created.`);
  }

  console.log('✅ Schedule computation completed successfully.');
  process.exit(0);
}

main();

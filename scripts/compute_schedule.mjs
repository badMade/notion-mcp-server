#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scheduleFile = path.join(rootDir, '.github', 'self-heal-schedule.yml');

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', cwd: rootDir }).trim();
  } catch (error) {
    console.error(`Warning: Command failed: ${command}`);
    return null;
  }
}

function getCommitFrequency() {
  const output = runCommand('git log --format=%aI --since="30 days ago"');
  if (!output) return 'standard';

  const lines = output.split('\\n').filter(Boolean);
  if (lines.length > 100) return 'high';
  if (lines.length > 50) return 'active';
  if (lines.length > 10) return 'standard';
  if (lines.length > 0) return 'low-churn';
  return 'dormant';
}

function computeSchedule(tier) {
  // Mapping tiers to crontab schedules
  // Note: Schedules should be pseudo-randomized or spread to avoid massive spikes,
  // but for simplicity we map to standard expressions.
  switch (tier) {
    case 'high':
      return '0 */4 * * *'; // Every 4 hours
    case 'active':
      return '0 */8 * * *'; // Every 8 hours
    case 'standard':
      return '0 0 * * *';   // Daily at midnight
    case 'low-churn':
      return '0 0 * * 0';   // Weekly on Sunday
    case 'dormant':
      return '0 0 1 * *';   // Monthly on 1st
    default:
      return '0 0 * * *';   // Default standard
  }
}

function main() {
  console.log('Gathering telemetry to compute optimal self-heal schedule...');

  // 1. Guard against oscillation: Do not recompute if recently updated (e.g., within 24h)
  let existingConfig = {};
  if (fs.existsSync(scheduleFile)) {
    try {
      const fileContent = fs.readFileSync(scheduleFile, 'utf8');
      existingConfig = yaml.load(fileContent);

      const lastUpdated = new Date(existingConfig.last_updated);
      const now = new Date();
      const diffHours = (now - lastUpdated) / (1000 * 60 * 60);

      if (diffHours < 24) {
        console.log(`Schedule was updated ${diffHours.toFixed(2)} hours ago. Skipping recompute to avoid oscillation.`);
        process.exit(0);
      }
    } catch (e) {
      console.warn('Failed to parse existing schedule file, proceeding with compute.', e.message);
    }
  }

  // 2. Gather telemetry
  const tier = getCommitFrequency();
  const scheduleExpr = computeSchedule(tier);
  console.log(`Determined tier: ${tier}, resulting in schedule: ${scheduleExpr}`);

  if (existingConfig.schedule === scheduleExpr) {
    console.log('Schedule expression unchanged. Exiting.');
    // Do NOT write to disk if schedule is unchanged to avoid git diff and PR thrashing
    process.exit(0);
  }

  // 3. Update the schedule file
  const newConfig = {
    schedule: scheduleExpr,
    rationale: `Computed based on telemetry indicating ${tier} commit frequency.`,
    last_updated: new Date().toISOString(),
    _marker: 'AUTO-UPDATED'
  };

  const yamlStr = yaml.dump(newConfig);
  fs.writeFileSync(scheduleFile, yamlStr);
  console.log(`Wrote new schedule to ${scheduleFile}`);
}

main();

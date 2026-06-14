#!/usr/bin/env node

/**
 * Computes self-healing schedule dynamically based on git/gh telemetry.
 * Adjusts cadence tiers based on commit frequency/PR frequency.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const scheduleFile = resolve(rootDir, '.github', 'self-heal-schedule.yml');

// Oscillation guard
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function getCommitCount() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = execSync(`git rev-list --count --since="${since}" HEAD`, { cwd: rootDir, encoding: 'utf-8' });
    return parseInt(result.trim() || '0', 10);
  } catch (e) {
    return 0; // Fallback
  }
}

function computeSchedule(commits) {
  let tier = '';
  let cron = '';
  if (commits > 100) {
    tier = 'high';
    cron = '0 */6 * * *'; // Every 6 hours
  } else if (commits > 50) {
    tier = 'active';
    cron = '0 */12 * * *'; // Every 12 hours
  } else if (commits > 10) {
    tier = 'standard';
    cron = '0 0 * * *'; // Daily
  } else if (commits > 0) {
    tier = 'low-churn';
    cron = '0 0 * * 0'; // Weekly on Sunday
  } else {
    tier = 'dormant';
    cron = '0 0 1 * *'; // Monthly
  }
  return { tier, cron };
}

function checkOscillationGuard() {
  if (fs.existsSync(scheduleFile)) {
    try {
      const content = fs.readFileSync(scheduleFile, 'utf-8');
      const data = yaml.load(content);
      if (data && data.lastUpdated) {
        const lastUpdatedDate = new Date(data.lastUpdated);
        const now = new Date();
        if (now - lastUpdatedDate < MIN_UPDATE_INTERVAL_MS) {
          console.log(`Skipping schedule update. Last updated ${lastUpdatedDate.toISOString()}, need to wait 3 days.`);
          return true;
        }
      }
    } catch (e) {
      console.warn("Could not read previous schedule file, proceeding with compute.");
    }
  }
  return false;
}

function updateScheduleFile(cron, tier, commits) {
  const data = {
    schedule: cron,
    tier: tier,
    rationale: `Computed based on ${commits} commits in the last 30 days.`,
    lastUpdated: new Date().toISOString()
  };

  const yamlStr = yaml.dump(data, { forceQuotes: true });
  fs.writeFileSync(scheduleFile, yamlStr, 'utf-8');
  console.log(`Updated schedule file to: ${cron}`);
}

function run() {
  console.log('Computing new schedule...');

  if (checkOscillationGuard() && process.env.FORCE_COMPUTE !== 'true') {
      process.exit(0);
  }

  const commits = getCommitCount();
  const { cron, tier } = computeSchedule(commits);

  updateScheduleFile(cron, tier, commits);
}

run();

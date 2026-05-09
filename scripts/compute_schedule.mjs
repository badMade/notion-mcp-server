#!/usr/bin/env node

/**
 * Compute Schedule Script
 * Computes an optimal self-heal schedule based on Git telemetry (PR and commit activity).
 * Uses js-yaml to safely round-trip the .github/self-heal-schedule.yml file.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const scheduleFilePath = join(projectRoot, '.github', 'self-heal-schedule.yml');

function getTelemetry() {
  try {
    // Count commits in the last 30 days
    const commitCountStr = execSync('git log --since="30 days ago" --oneline | wc -l', { cwd: projectRoot, encoding: 'utf8' });
    const commitCount = parseInt(commitCountStr.trim(), 10) || 0;

    return { commitCount };
  } catch (error) {
    console.error('Warning: Could not fetch git telemetry. Defaulting to 0.');
    return { commitCount: 0 };
  }
}

function computeSchedule(telemetry) {
  const { commitCount } = telemetry;

  // Cadence Tiers based on commits in the last 30 days
  if (commitCount > 100) {
    // High velocity: run every 6 hours
    return { cron: '0 */6 * * *', tier: 'high', rationale: '>100 commits in last 30 days' };
  } else if (commitCount > 30) {
    // Active velocity: run every 12 hours
    return { cron: '0 */12 * * *', tier: 'active', rationale: '>30 commits in last 30 days' };
  } else if (commitCount > 10) {
    // Standard velocity: run daily at midnight UTC
    return { cron: '0 0 * * *', tier: 'standard', rationale: '>10 commits in last 30 days' };
  } else if (commitCount > 0) {
    // Low-churn velocity: run weekly on Sunday at midnight UTC
    return { cron: '0 0 * * 0', tier: 'low-churn', rationale: '>0 commits in last 30 days' };
  } else {
    // Dormant velocity: run monthly on the 1st at midnight UTC
    return { cron: '0 0 1 * *', tier: 'dormant', rationale: '0 commits in last 30 days' };
  }
}

function updateScheduleFile(scheduleInfo) {
  let doc = { schedule: {} };

  if (fs.existsSync(scheduleFilePath)) {
    try {
      const fileContents = fs.readFileSync(scheduleFilePath, 'utf8');
      doc = yaml.load(fileContents) || doc;

      // Oscillation guard: Skip if updated in the last 6 days
      if (doc.schedule && doc.schedule.last_updated) {
        const lastUpdatedDate = new Date(doc.schedule.last_updated);
        const now = new Date();
        const diffMs = now - lastUpdatedDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < 6) {
          console.log(`Schedule was recently updated (${diffDays.toFixed(1)} days ago). Skipping recompute to avoid oscillation.`);
          process.exit(0);
        }
      }
    } catch (e) {
      console.error(`Error reading existing schedule file: ${e.message}`);
    }
  }

  // Update values
  doc.schedule = {
    cron: scheduleInfo.cron,
    tier: scheduleInfo.tier,
    rationale: scheduleInfo.rationale,
    last_updated: new Date().toISOString()
  };

  try {
    const yamlStr = yaml.dump(doc);
    // Append the mandatory auto-updated marker
    const finalContent = `# AUTO-UPDATED\n${yamlStr}`;

    // Ensure directory exists
    const dir = dirname(scheduleFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(scheduleFilePath, finalContent, 'utf8');
    console.log(`Successfully wrote computed schedule to ${scheduleFilePath}`);
    console.log(`Schedule: ${scheduleInfo.cron} (Tier: ${scheduleInfo.tier})`);
  } catch (e) {
    console.error(`Error writing schedule file: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('Computing self-heal schedule based on telemetry...');
  const telemetry = getTelemetry();
  console.log(`Telemetry: ${telemetry.commitCount} commits in last 30 days`);

  const scheduleInfo = computeSchedule(telemetry);
  updateScheduleFile(scheduleInfo);
}

main();

#!/usr/bin/env node

/**
 * Computes an adaptive cron schedule based on repository telemetry.
 * Safely updates .github/self-heal-schedule.yml using js-yaml.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const scheduleFile = path.join(projectRoot, '.github', 'self-heal-schedule.yml');

function getCommitCount() {
  try {
    const output = execSync('git log --since="7 days ago" --oneline', { cwd: projectRoot, encoding: 'utf-8' });
    return output.trim().split('\n').filter(line => line.length > 0).length;
  } catch (error) {
    return 0; // Fallback if no history or error
  }
}

function computeSchedule(commitsPerWeek) {
  // Telemetry-derived cadence tiers
  if (commitsPerWeek > 50) {
    return { cron: '0 */4 * * *', rationale: 'High velocity (>50 commits/week). Scheduling every 4 hours.' };
  } else if (commitsPerWeek > 20) {
    return { cron: '0 */12 * * *', rationale: 'Active velocity (>20 commits/week). Scheduling every 12 hours.' };
  } else if (commitsPerWeek > 5) {
    return { cron: '0 2 * * *', rationale: 'Standard velocity (>5 commits/week). Scheduling daily at 02:00.' };
  } else if (commitsPerWeek > 0) {
    return { cron: '0 2 * * 1,4', rationale: 'Low-churn velocity (>0 commits/week). Scheduling twice weekly.' };
  } else {
    return { cron: '0 2 * * 1', rationale: 'Dormant velocity (0 commits/week). Scheduling once weekly.' };
  }
}

function main() {
  console.log('Calculating adaptive schedule based on telemetry...');
  const commitsPerWeek = getCommitCount();
  console.log(`Commits in last 7 days: ${commitsPerWeek}`);

  const { cron, rationale } = computeSchedule(commitsPerWeek);
  console.log(`Computed schedule: ${cron}`);
  console.log(`Rationale: ${rationale}`);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(scheduleFile), { recursive: true });

  let existingCron = null;
  if (fs.existsSync(scheduleFile)) {
    try {
      const existingContent = fs.readFileSync(scheduleFile, 'utf8');
      const match = existingContent.match(/schedule:\s*(.+)/);
      if (match) {
        existingCron = match[1].trim();
      }
    } catch (e) {
      // Ignore read errors and proceed
    }
  }

  if (existingCron === cron) {
    console.log('Schedule unchanged. Skipping update.');
    return;
  }

  const scheduleData = {
    schedule: cron,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  // Convert to YAML and append the required `# AUTO-UPDATED` marker
  const yamlString = yaml.dump(scheduleData);
  const finalContent = `# AUTO-UPDATED\n${yamlString}`;

  fs.writeFileSync(scheduleFile, finalContent, 'utf-8');
  console.log(`Updated ${scheduleFile} successfully.`);
}

main();

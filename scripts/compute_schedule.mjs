#!/usr/bin/env node

/**
 * Compute Schedule script.
 * Gathers repository telemetry and calculates an optimal schedule for self-healing.
 * Updates .github/self-heal-schedule.yml using safe YAML round-trip via js-yaml.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE_PATH = path.join(REPO_ROOT, '.github', 'self-heal-schedule.yml');

function runCommandOutput(command, args) {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf-8' });
  if (result.status !== 0) {
    console.warn(`Command failed: ${command} ${args.join(' ')}\n${result.stderr}`);
    return null;
  }
  return result.stdout.trim();
}

function getCommitCount() {
  const output = runCommandOutput('git', ['rev-list', '--count', '--since="7 days ago"', 'HEAD']);
  return output ? parseInt(output, 10) : 0;
}

function computeSchedule(commitCount) {
  // Logic based on commit velocity
  let scheduleExpression;
  let rationale;

  if (commitCount > 50) {
    scheduleExpression = '0 */4 * * *'; // Every 4 hours
    rationale = 'High velocity (more than 50 commits in 7 days). Checking frequently.';
  } else if (commitCount > 10) {
    scheduleExpression = '0 */12 * * *'; // Every 12 hours
    rationale = 'Standard velocity (11-50 commits in 7 days). Checking twice a day.';
  } else if (commitCount > 0) {
    scheduleExpression = '0 0 * * *'; // Daily
    rationale = 'Low velocity (1-10 commits in 7 days). Checking daily.';
  } else {
    scheduleExpression = '0 0 * * 1'; // Weekly on Monday
    rationale = 'Dormant velocity (0 commits in 7 days). Checking weekly.';
  }

  return { scheduleExpression, rationale };
}

function main() {
  console.log('Computing optimal self-heal schedule...');
  const commitCount = getCommitCount();
  console.log(`Detected ${commitCount} commits in the last 7 days.`);

  const { scheduleExpression, rationale } = computeSchedule(commitCount);
  console.log(`Calculated Schedule: "${scheduleExpression}"`);
  console.log(`Rationale: ${rationale}`);

  // Create .github dir if it doesn't exist
  const githubDir = path.dirname(SCHEDULE_FILE_PATH);
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  let scheduleConfig = {
    schedule: scheduleExpression,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  // If file exists, update it to preserve any other structure (though it should be simple)
  if (fs.existsSync(SCHEDULE_FILE_PATH)) {
    try {
      const existingContent = fs.readFileSync(SCHEDULE_FILE_PATH, 'utf-8');
      const parsed = yaml.load(existingContent);
      if (parsed && typeof parsed === 'object') {
        scheduleConfig = { ...parsed, ...scheduleConfig };
      }
    } catch (e) {
      console.warn('Failed to parse existing schedule file, overwriting.');
    }
  }

  // Write new config
  const yamlContent = yaml.dump(scheduleConfig, { lineWidth: -1 });
  // Add the required AUTO-UPDATED marker
  const fileContent = `# AUTO-UPDATED\n${yamlContent}`;

  fs.writeFileSync(SCHEDULE_FILE_PATH, fileContent, 'utf-8');
  console.log(`Successfully updated ${SCHEDULE_FILE_PATH}`);
}

main();

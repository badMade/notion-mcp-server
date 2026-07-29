#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const SCHEDULE_FILE = join(projectRoot, '.github', 'self-heal-schedule.yml');

// Get recent commits (last 14 days)
function getRecentCommits() {
  try {
    const output = execSync('git log --since="14 days ago" --format="%aI"', { cwd: projectRoot }).toString().trim();
    return output ? output.split('\n').length : 0;
  } catch (e) {
    return 0; // fallback
  }
}

// Compute cadence based on commit frequency
function computeCadence(commits) {
  if (commits > 50) return { cron: '0 */4 * * *', rationale: 'High velocity (>50 commits/14d)' };
  if (commits > 20) return { cron: '0 */8 * * *', rationale: 'Active velocity (>20 commits/14d)' };
  if (commits > 5)  return { cron: '0 0 * * *',   rationale: 'Standard velocity (>5 commits/14d)' };
  if (commits > 0)  return { cron: '0 0 * * 1',   rationale: 'Low churn (>0 commits/14d)' };
  return { cron: '0 0 1 * *', rationale: 'Dormant (0 commits/14d)' };
}

function main() {
  const commits = getRecentCommits();
  const cadence = computeCadence(commits);
  const now = new Date().toISOString();

  let existingSchedule = {};
  if (existsSync(SCHEDULE_FILE)) {
    try {
      existingSchedule = yaml.load(readFileSync(SCHEDULE_FILE, 'utf8')) || {};
    } catch (e) {
      console.warn('Could not read existing schedule file, creating new one.');
    }
  }

  // Oscillation guard: skip if updated in the last 3 days
  if (existingSchedule.LAST_UPDATED) {
    const lastUpdateDate = new Date(existingSchedule.LAST_UPDATED);
    const diffDays = (new Date() - lastUpdateDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 3 && existingSchedule.SELFHEAL_SCHEDULE === cadence.cron) {
      console.log('Schedule up to date and recently evaluated. Skipping update.');
      process.exit(0);
    }
  }

  const newSchedule = {
    SELFHEAL_SCHEDULE: cadence.cron,
    RATIONALE: cadence.rationale,
    LAST_UPDATED: now
  };

  const yamlStr = yaml.dump(newSchedule, { forceQuotes: true });
  writeFileSync(SCHEDULE_FILE, yamlStr);
  console.log(`Updated schedule to ${cadence.cron} based on ${commits} commits in last 14 days.`);

  // Fallback sed for the workflow file if needed (as per memory)
  const workflowFile = join(projectRoot, '.github', 'workflows', 'self-heal.yml');
  if (existsSync(workflowFile)) {
    let content = readFileSync(workflowFile, 'utf8');
    // Regex matches the schedule line with the # AUTO-UPDATED marker
    content = content.replace(
      /- cron:\s*".*"\s*# AUTO-UPDATED/g,
      `- cron: "${cadence.cron}" # AUTO-UPDATED`
    );
    writeFileSync(workflowFile, content);
  }
}

main();

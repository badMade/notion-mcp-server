#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Computes an optimal self-heal schedule based on git telemetry.
 * Uses js-yaml to update .github/workflows/self-heal.yml and .github/self-heal-schedule.yml.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const WORKFLOW_FILE = path.join('.github', 'workflows', 'self-heal.yml');
const SCHEDULE_FILE = path.join('.github', 'self-heal-schedule.yml');

function runGitCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function computeOptimalSchedule() {
  // Determine cadence from git history
  const commitCountStr = runGitCmd('git rev-list --count HEAD --since="1 month ago"');
  const commitCount = parseInt(commitCountStr || '0', 10);

  let scheduleStr = '0 0 * * *'; // default: standard (daily at midnight)
  let rationaleStr = 'Default standard schedule based on fallback logic.';

  if (commitCount > 50) {
    scheduleStr = '0 */6 * * *'; // high velocity
    rationaleStr = `High commit velocity (${commitCount} commits last month), running every 6 hours.`;
  } else if (commitCount > 10) {
    scheduleStr = '0 0 * * *'; // active velocity
    rationaleStr = `Active commit velocity (${commitCount} commits last month), running daily.`;
  } else {
    scheduleStr = '0 0 * * 0'; // low-churn
    rationaleStr = `Low commit velocity (${commitCount} commits last month), running weekly.`;
  }

  return { schedule: scheduleStr, rationale: rationaleStr };
}

function updateYamlFiles(schedule, rationale) {
  // Update self-heal-schedule.yml
  const scheduleData = {
    schedule,
    rationale,
    last_updated: new Date().toISOString(),
    _marker: '# AUTO-UPDATED'
  };
  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData));
  console.log(`Updated ${SCHEDULE_FILE} with schedule: ${schedule}`);

  // Update self-heal.yml
  if (fs.existsSync(WORKFLOW_FILE)) {
    const workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf-8');
    try {
      const doc = yaml.load(workflowContent);
      if (doc && doc.on && doc.on.schedule) {
        doc.on.schedule = [{ cron: schedule }];
        fs.writeFileSync(WORKFLOW_FILE, yaml.dump(doc));
        console.log(`Updated ${WORKFLOW_FILE} with schedule: ${schedule}`);
      }
    } catch (err) {
      // Fallback using regex replacement if YAML parsing fails (preserving comments)
      console.log('Falling back to regex replacement for self-heal.yml');
      const updatedContent = workflowContent.replace(
        /cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/,
        `cron: '${schedule}' # AUTO-UPDATED`
      );
      fs.writeFileSync(WORKFLOW_FILE, updatedContent);
    }
  } else {
    console.warn(`${WORKFLOW_FILE} does not exist yet. Ensure it is created.`);
  }
}

function main() {
  console.log('Computing optimal schedule based on telemetry...');
  const { schedule, rationale } = computeOptimalSchedule();

  updateYamlFiles(schedule, rationale);
}

main();

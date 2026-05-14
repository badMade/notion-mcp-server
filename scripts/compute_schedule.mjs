#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import process from 'process';

function runCommand(command) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
}

console.log('Computing optimal self-heal schedule...');

// Telemetry gathering (mocked for environment without gh cli, but using real git logs)
// For a real implementation with gh cli, we'd use:
// const prs = runCommand('gh pr list --state merged --json mergedAt');
// const ciRuns = runCommand('gh run list --workflow=ci --json conclusion');

const gitLog = runCommand('git log --format=%aI -n 50');
const commitLines = gitLog.split('\n').filter(Boolean);
const commitCount = commitLines.length;

let newSchedule = '0 0 * * 0'; // Default: Weekly on Sunday
let rationale = 'Default low-churn schedule.';

if (commitCount === 0) {
    newSchedule = '0 0 1 * *'; // Monthly
    rationale = 'Dormant repository. Running monthly.';
} else if (commitCount < 5) {
    newSchedule = '0 0 * * 0'; // Weekly on Sunday
    rationale = 'Low-churn repository (< 5 recent commits). Running weekly.';
} else if (commitCount < 20) {
    newSchedule = '0 0 * * *'; // Daily at midnight
    rationale = 'Standard repository activity. Running daily.';
} else {
    newSchedule = '0 */12 * * *'; // Twice a day
    rationale = 'High repository activity. Running twice a day.';
}

console.log(`Computed Schedule: ${newSchedule}`);
console.log(`Rationale: ${rationale}`);

const scheduleFilePath = path.join(process.cwd(), '.github', 'self-heal-schedule.yml');
const workflowFilePath = path.join(process.cwd(), '.github', 'workflows', 'self-heal.yml');

// Safely update schedule file using js-yaml
try {
  let scheduleData = {};
  if (fs.existsSync(scheduleFilePath)) {
     const fileContents = fs.readFileSync(scheduleFilePath, 'utf8');
     scheduleData = yaml.load(fileContents) || {};
  }

  // Check if schedule actually changed
  if (scheduleData.schedule === newSchedule || scheduleData.schedule === `${newSchedule} # AUTO-UPDATED`) {
      console.log('Schedule unchanged. Exiting.');
      process.exit(0);
  }

  scheduleData.schedule = newSchedule;
  scheduleData.rationale = rationale;
  scheduleData.last_updated = new Date().toISOString();

  // Write back using js-yaml
  let yamlStr = yaml.dump(scheduleData);
  yamlStr = yamlStr.replace(`schedule: '${newSchedule}'`, `schedule: "${newSchedule}" # AUTO-UPDATED`).replace(`schedule: ${newSchedule}`, `schedule: "${newSchedule}" # AUTO-UPDATED`);
  // js-yaml escapes the #, so we need to fix the marker

  if (!fs.existsSync(path.dirname(scheduleFilePath))) {
      fs.mkdirSync(path.dirname(scheduleFilePath), { recursive: true });
  }
  fs.writeFileSync(scheduleFilePath, yamlStr, 'utf8');
  console.log(`Updated ${scheduleFilePath}`);

} catch (e) {
  console.error('Error updating schedule file:', e);
  process.exit(1);
}

// Update the workflow file (sed fallback / regex update)
try {
    if (fs.existsSync(workflowFilePath)) {
        let workflowContent = fs.readFileSync(workflowFilePath, 'utf8');
        workflowContent = workflowContent.replace(/cron: ".*" # AUTO-UPDATED/g, `cron: "${newSchedule}" # AUTO-UPDATED`);
        workflowContent = workflowContent.replace(/cron: '.*' # AUTO-UPDATED/g, `cron: "${newSchedule}" # AUTO-UPDATED`);
        fs.writeFileSync(workflowFilePath, workflowContent, 'utf8');
        console.log(`Updated ${workflowFilePath}`);
    } else {
        console.log(`Workflow file not found at ${workflowFilePath}, skipping.`);
    }
} catch (e) {
    console.error('Error updating workflow file:', e);
    process.exit(1);
}

console.log('Schedule update complete.');

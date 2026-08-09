#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

let scheduleExpression = "0 3 * * *";
let rationale = "Fallback default due to insufficient telemetry.";

try {
  const recentCommits = execSync('git log --since="7 days ago" --oneline').toString().trim().split('\n').filter(Boolean).length;
  if (recentCommits > 10) {
    scheduleExpression = "0 */4 * * *";
    rationale = "High churn detected (>10 commits in last 7 days). Scheduling every 4 hours.";
  } else if (recentCommits > 0) {
    scheduleExpression = "0 0 * * *";
    rationale = "Moderate churn detected. Scheduling daily at midnight.";
  } else {
    scheduleExpression = "0 0 * * 0";
    rationale = "Low churn detected. Scheduling weekly on Sunday.";
  }
} catch (e) {
  console.error("Error reading git telemetry, using fallback.", e);
}

const scheduleFile = '.github/self-heal-schedule.yml';
let currentData = {};
try {
  if (fs.existsSync(scheduleFile)) {
    currentData = yaml.load(fs.readFileSync(scheduleFile, 'utf8')) || {};
  }
} catch (e) {}

if (currentData.schedule !== scheduleExpression) {
  const newContent = yaml.dump({
    schedule: scheduleExpression,
    rationale: rationale,
    last_updated: new Date().toISOString()
  });
  const finalYaml = newContent.replace(/schedule: (.*)/, 'schedule: $1 # AUTO-UPDATED');
  fs.writeFileSync(scheduleFile, finalYaml);
  console.log(`Updated schedule to ${scheduleExpression}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_changed=true\n');
  }

  const workflowFile = '.github/workflows/self-heal.yml';
  if (fs.existsSync(workflowFile)) {
    let wfContent = fs.readFileSync(workflowFile, 'utf8');
    wfContent = wfContent.replace(/cron:\s*['"][^'"]*['"]\s*# AUTO-UPDATED/, `cron: '${scheduleExpression}' # AUTO-UPDATED`);
    fs.writeFileSync(workflowFile, wfContent);
  }
} else {
  console.log('Schedule unchanged.');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_changed=false\n');
  }
}

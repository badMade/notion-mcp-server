#!/usr/bin/env node
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';
import fs from 'fs';

let prVelocity = 'standard';
try {
  const gitLog = execSync('git log --format="%aI" | head -n 50', { stdio: 'pipe' }).toString();
  const commitCount = gitLog.split('\n').filter(Boolean).length;
  if (commitCount > 30) prVelocity = 'high';
  else if (commitCount > 10) prVelocity = 'active';
  else if (commitCount > 0) prVelocity = 'standard';
  else prVelocity = 'low-churn';
} catch (e) {
  prVelocity = 'standard';
}

const schedules = {
  'high': '0 */4 * * *',
  'active': '0 */8 * * *',
  'standard': '0 0 * * *',
  'low-churn': '0 0 * * 0',
  'dormant': '0 0 1 * *'
};

const newSchedule = schedules[prVelocity] || '0 0 * * *';
const scheduleFilePath = '.github/self-heal-schedule.yml';
const workflowFilePath = '.github/workflows/self-heal.yml';

if (fs.existsSync(scheduleFilePath)) {
  const content = fs.readFileSync(scheduleFilePath, 'utf8');
  let parsed = yaml.load(content) || {};
  if (parsed.schedule !== newSchedule) {
    parsed.schedule = newSchedule;
    parsed.rationale = `Computed based on velocity: ${prVelocity}`;
    let newContent = yaml.dump(parsed);
    newContent = newContent.replace(/(schedule:.*)/, '$1 # AUTO-UPDATED');
    fs.writeFileSync(scheduleFilePath, newContent);
  }
}

if (fs.existsSync(workflowFilePath)) {
  let wfContent = fs.readFileSync(workflowFilePath, 'utf8');
  wfContent = wfContent.replace(/cron: '.*' # AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);
  fs.writeFileSync(workflowFilePath, wfContent);
}

console.log(`Computed schedule: ${newSchedule}`);

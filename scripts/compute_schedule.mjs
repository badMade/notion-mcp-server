#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scheduleFile = join(__dirname, '..', '.github', 'self-heal-schedule.yml');

// Telemetry collection
let mergeCount = 0;
let ciFailures = 0;
try {
  const mergedPrs = execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf8' });
  mergeCount = JSON.parse(mergedPrs).length;

  const runs = execSync('gh run list --workflow=ci --json conclusion --limit 100', { encoding: 'utf8' });
  ciFailures = JSON.parse(runs).filter(r => r.conclusion === 'failure').length;
} catch (e) {
  console.log('Failed to fetch telemetry, using defaults');
}

// Compute new schedule
let newSchedule = '0 0 * * *'; // default: daily
let rationale = 'Default low-churn schedule';
if (mergeCount > 20 || ciFailures > 10) {
  newSchedule = '0 */4 * * *'; // high velocity
  rationale = 'High velocity/churn detected';
} else if (mergeCount > 5) {
  newSchedule = '0 */12 * * *'; // active
  rationale = 'Active development detected';
}

console.log(`Computed new schedule: ${newSchedule}`);

// Read current schedule
let currentConfig = {};
let fileContent = '';
try {
  fileContent = fs.readFileSync(scheduleFile, 'utf8');
  currentConfig = yaml.load(fileContent) || {};
} catch (e) {
  console.log('Could not read existing schedule file');
}

const currentSchedule = currentConfig.schedule;
if (newSchedule === currentSchedule) {
  console.log('Schedule unchanged.');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_changed=false\n');
  }
  process.exit(0);
}

// Write new schedule
currentConfig.schedule = newSchedule;
currentConfig.rationale = rationale;
currentConfig.last_updated = new Date().toISOString();

const newContent = yaml.dump(currentConfig);
// Preserve # AUTO-UPDATED marker
const finalContent = newContent.replace(/schedule: (.*)/, 'schedule: $1 # AUTO-UPDATED');

fs.writeFileSync(scheduleFile, finalContent);
console.log('Updated schedule file.');

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'schedule_changed=true\n');
}

#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';

let commits = 0;
let prCount = 0;
let hourCounts = Array(24).fill(0);

try {
  const log = execSync('git log --since="7 days ago" --format=%aI', { stdio: 'pipe' }).toString();
  const lines = log.split('\n').filter(Boolean);
  commits = lines.length;
  for (const line of lines) {
    const date = new Date(line);
    hourCounts[date.getUTCHours()]++;
  }
} catch (e) {}

try {
  const prs = execSync('gh pr list --state merged --json mergedAt -q "length" || echo 0', { stdio: 'pipe' }).toString().trim();
  prCount = parseInt(prs, 10);
} catch (e) {}

let quietestHour = 0;
let minCount = Infinity;
for (let i = 0; i < 24; i++) {
  if (hourCounts[i] < minCount) {
    minCount = hourCounts[i];
    quietestHour = i;
  }
}

let schedule = `0 ${quietestHour} * * 0`; // rare / dormant
if (prCount > 10 || commits > 50) {
  schedule = `0 */4 * * *`; // high
} else if (prCount > 5 || commits > 20) {
  schedule = `0 */12 * * *`; // active
} else if (prCount > 0 || commits > 5) {
  schedule = `0 ${quietestHour} * * *`; // standard
}

const schedFilePath = '.github/self-heal-schedule.yml';
let oldSchedule = '';
let consecEmpty = 0;
let consecSuccess = 0;
try {
  const file = fs.readFileSync(schedFilePath, 'utf8');
  const doc = yaml.load(file);
  oldSchedule = doc.SELFHEAL_SCHEDULE;
  consecEmpty = doc.CONSECUTIVE_EMPTY || 0;
  consecSuccess = doc.CONSECUTIVE_SUCCESS || 0;
} catch (e) {}

if (consecEmpty >= 3) {
  schedule = `0 0 * * 0`; // Reduce frequency
} else if (consecSuccess >= 3) {
  schedule = `0 */4 * * *`; // Increase frequency
}

if (schedule === oldSchedule) { console.log("Schedule unchanged."); process.exit(0); }

const schedData = {
  SELFHEAL_SCHEDULE: schedule,
  RATIONALE: `Computed from ${commits} commits, ${prCount} PRs. Quietest hour: ${quietestHour}`,
  LAST_UPDATED: new Date().toISOString(),
  CONSECUTIVE_EMPTY: 0,
  CONSECUTIVE_SUCCESS: 0
};

let newSchedYaml = yaml.dump(schedData);
newSchedYaml = newSchedYaml.replace(/\n$/, '') + ' # AUTO-UPDATED\n';
fs.writeFileSync(schedFilePath, newSchedYaml);

const wfPath = '.github/workflows/self-heal.yml';
try {
  let wf = fs.readFileSync(wfPath, 'utf8');
  wf = wf.replace(/cron: ".*" # AUTO-UPDATED/, `cron: "${schedule}" # AUTO-UPDATED`);
  fs.writeFileSync(wfPath, wf);
} catch (e) {}

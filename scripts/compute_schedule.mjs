#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';
import yaml from 'js-yaml';

const scheduleFile = '.github/self-heal-schedule.yml';
let lastUpdatedStr = null;
let currentSchedule = '0 3 * * *';

if (fs.existsSync(scheduleFile)) {
  try {
    const doc = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
    lastUpdatedStr = doc.lastUpdated;
    currentSchedule = doc.schedule || currentSchedule;
  } catch (e) {}
}

if (lastUpdatedStr) {
  const lastUpdated = new Date(lastUpdatedStr);
  const diffDays = (new Date() - lastUpdated) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) {
    console.log('Schedule was updated recently. Skipping recompute.');
    process.exit(0);
  }
}

let commits = [];
try {
  const gitLog = execSync('git log --format=%aI --since="30 days ago"', { stdio: 'pipe' }).toString().trim();
  commits = gitLog ? gitLog.split('\n') : [];
} catch (e) {}

let prs = [];
try {
  const ghPrs = execSync('gh pr list --state merged --json mergedAt --limit 100', { stdio: 'pipe' }).toString().trim();
  prs = JSON.parse(ghPrs);
} catch (e) {}

const prCount = prs.length;
let schedule = '';
let rationale = '';

const hourCounts = Array(24).fill(0);
commits.forEach(c => {
  const date = new Date(c);
  if (!isNaN(date.getTime())) hourCounts[date.getHours()]++;
});
let minHour = 0;
for (let i = 1; i < 24; i++) {
  if (hourCounts[i] < hourCounts[minHour]) minHour = i;
}

if (prCount > 50) {
  schedule = `0 ${minHour},${(minHour+4)%24},${(minHour+8)%24},${(minHour+12)%24},${(minHour+16)%24},${(minHour+20)%24} * * *`;
  rationale = `High PR velocity, running multiple times per active period around quiet hour ${minHour}`;
}
else if (prCount > 20) {
  schedule = `0 ${minHour},${(minHour+8)%24},${(minHour+16)%24} * * *`;
  rationale = `Active PR velocity, running frequently around quiet hour ${minHour}`;
}
else if (prCount > 5) {
  schedule = `0 ${minHour} * * *`;
  rationale = `Standard PR velocity, running daily at quiet hour ${minHour}`;
}
else if (prCount > 0) {
  schedule = `0 ${minHour} * * 0`;
  rationale = `Low PR velocity, running weekly on quiet hour ${minHour}`;
}
else {
  schedule = `0 ${minHour} 1 * *`;
  rationale = `Dormant PR velocity, running monthly on quiet hour ${minHour}`;
}

if (schedule === currentSchedule) {
  console.log('Schedule unchanged. Exiting.');
  process.exit(0);
}

const newConfig = { schedule, rationale, lastUpdated: new Date().toISOString() };
fs.writeFileSync(scheduleFile, yaml.dump(newConfig) + '\n# AUTO-UPDATED\n');

const workflowFile = '.github/workflows/self-heal.yml';
if (fs.existsSync(workflowFile)) {
  let content = fs.readFileSync(workflowFile, 'utf8');
  let parsed = yaml.load(content);
  if (parsed?.on?.schedule?.[0]?.cron) {
    parsed.on.schedule[0].cron = schedule;
    let dumped = yaml.dump(parsed, { lineWidth: -1 });
    const escapedSchedule = schedule.replace(/\*/g, '\\*');
    dumped = dumped.replace(new RegExp(`- cron: ['"]?${escapedSchedule}['"]?`), `- cron: "${schedule}" # AUTO-UPDATED`);
    fs.writeFileSync(workflowFile, dumped);
  }
}

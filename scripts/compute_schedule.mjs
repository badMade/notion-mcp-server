#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

const CONFIG_PATH = '.github/self-heal-schedule.yml';

const execCommand = (cmd) => {
  try {
    return execSync(cmd).toString().trim();
  } catch (e) {
    return '';
  }
};

// Gather telemetry
const prListJsonStr = execCommand('gh pr list --state merged --json mergedAt --limit 100') || '[]';
const prs = JSON.parse(prListJsonStr);
const prVelocity = prs.length;

const commitLogs = execCommand('git log --since="30 days ago" --format="%aI"');
const commits = commitLogs.split('\n').filter(Boolean);
const commitVelocity = commits.length;

// Find active period (mode of hour of day)
const hourCounts = Array(24).fill(0);
commits.forEach(c => {
  const date = new Date(c);
  if (!isNaN(date.getTime())) {
    hourCounts[date.getHours()]++;
  }
});

let mostActiveHour = 0;
let maxCount = 0;
hourCounts.forEach((count, hour) => {
  if (count > maxCount) {
    maxCount = count;
    mostActiveHour = hour;
  }
});

let quietHour = (mostActiveHour + 12) % 24;

// Cadence tiers
let minute = '0';
let hour = quietHour.toString();
let dayOfMonth = '*';
let month = '*';
let dayOfWeek = '*';
let rationale = 'Default fallback cadence.';

if (prVelocity > 30 || commitVelocity > 100) {
  hour = `${quietHour},${(quietHour + 6) % 24},${(quietHour + 12) % 24},${(quietHour + 18) % 24}`;
  rationale = 'High velocity tier due to significant PR and commit activity. Scheduled multiple times per day.';
} else if (prVelocity > 10 || commitVelocity > 30) {
  hour = `${quietHour},${(quietHour + 12) % 24}`;
  rationale = 'Active tier due to moderate activity. Scheduled twice a day.';
} else if (prVelocity > 3 || commitVelocity > 10) {
  hour = quietHour.toString();
  rationale = 'Standard tier due to low activity. Scheduled once a day.';
} else if (commitVelocity > 0) {
  hour = quietHour.toString();
  dayOfWeek = '0'; // Sundays
  rationale = 'Low-churn tier due to minimal activity. Scheduled once a week.';
} else {
  hour = quietHour.toString();
  dayOfMonth = '1'; // First of month
  rationale = 'Dormant tier due to zero activity. Scheduled once a month.';
}

const newSchedule = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;

const scheduleData = {
  schedule: newSchedule,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

const yamlStr = yaml.dump(scheduleData);
const fileContent = `# AUTO-UPDATED\n${yamlStr}`;
fs.writeFileSync(CONFIG_PATH, fileContent);
console.log(`Computed new schedule: ${newSchedule}`);

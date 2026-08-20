#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const scheduleFile = join(projectRoot, '.github', 'self-heal-schedule.yml');
const workflowFile = join(projectRoot, '.github', 'workflows', 'self-heal.yml');

// Schedule Oscillation Guard
const currentScheduleContent = fs.readFileSync(scheduleFile, 'utf8');
const currentSchedule = yaml.load(currentScheduleContent);
const lastUpdated = new Date(currentSchedule.last_updated);
const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

if (hoursSinceUpdate < 24) {
  console.log("Schedule updated within the last 24 hours. Skipping recompute to prevent oscillation.");
  process.exit(0);
}

let prVelocity = 'standard';
let cadence = '0 3 * * *'; // default
let rationale = "Default daily schedule based on fallback telemetry.";

try {
  // PR velocity: last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const mergedPrsOutput = execSync(`gh pr list --state merged --json mergedAt --search "merged:>=${sevenDaysAgo.split('T')[0]}"`, { stdio: 'pipe' }).toString();
  const prs = JSON.parse(mergedPrsOutput);

  if (prs.length > 20) prVelocity = 'high';
  else if (prs.length > 10) prVelocity = 'active';
  else if (prs.length > 3) prVelocity = 'standard';
  else if (prs.length > 0) prVelocity = 'low-churn';
  else prVelocity = 'dormant';

  // Find quietest window (commit hour-of-day mode of inactivity)
  const commitsOutput = execSync('git log --since="30 days ago" --format=%aI', { stdio: 'pipe' }).toString();
  const hours = Array(24).fill(0);
  commitsOutput.trim().split('\n').filter(Boolean).forEach(line => {
    const d = new Date(line);
    if (!isNaN(d.getTime())) {
      hours[d.getUTCHours()]++;
    }
  });

  let quietestHour = 0;
  let minCommits = Infinity;
  for (let i = 0; i < 24; i++) {
    // Look at 3-hour windows
    const windowSum = hours[i] + hours[(i+1)%24] + hours[(i+2)%24];
    if (windowSum < minCommits) {
      minCommits = windowSum;
      quietestHour = i;
    }
  }

  // Determine cadence based on velocity and quietest window
  if (prVelocity === 'high') {
    cadence = `0 ${quietestHour},${(quietestHour+8)%24},${(quietestHour+16)%24} * * *`;
    rationale = `High PR velocity detected. Scheduling 3 times a day starting before the quietest window at ${quietestHour}:00 UTC.`;
  } else if (prVelocity === 'active') {
    cadence = `0 ${quietestHour},${(quietestHour+12)%24} * * *`;
    rationale = `Active PR velocity detected. Scheduling twice a day starting before the quietest window at ${quietestHour}:00 UTC.`;
  } else if (prVelocity === 'standard') {
    cadence = `0 ${quietestHour} * * *`;
    rationale = `Standard PR velocity detected. Scheduling once a day before the quietest window at ${quietestHour}:00 UTC.`;
  } else if (prVelocity === 'low-churn') {
    cadence = `0 ${quietestHour} * * 1,4`;
    rationale = `Low PR churn detected. Scheduling twice a week (Mon, Thu) before the quietest window at ${quietestHour}:00 UTC.`;
  } else {
    cadence = `0 ${quietestHour} * * 0`;
    rationale = `Dormant PR velocity detected. Scheduling once a week on Sundays before the quietest window at ${quietestHour}:00 UTC.`;
  }
} catch (e) {
  console.log("Failed to fetch PR telemetry, using fallback.");
  cadence = "0 3 * * *";
  rationale = "Default daily schedule based on fallback telemetry due to error fetching data.";
}

if (currentSchedule.schedule === cadence) {
  console.log("Schedule unchanged.");
  process.exit(0);
}

const newScheduleObj = {
  schedule: cadence,
  rationale,
  last_updated: new Date().toISOString()
};
let newYaml = yaml.dump(newScheduleObj);
fs.writeFileSync(scheduleFile, newYaml);

let workflowContent = fs.readFileSync(workflowFile, 'utf8');
workflowContent = workflowContent.replace(/cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED/, `cron: "${cadence}" # AUTO-UPDATED`);
fs.writeFileSync(workflowFile, workflowContent);

console.log(`Updated schedule to ${cadence}`);
process.exit(0);
#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import process from 'process';
import yaml from 'js-yaml';

// Guard against rapid recomputation
const CONFIG_PATH = '.github/self-heal-schedule.yml';
let currentConfig = { schedule: "0 3 * * 1", reason: "Fallback", last_updated: "" };

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    currentConfig = yaml.load(fileContents);
  } catch (e) {
    console.error('Could not load current config, using defaults.');
  }
}

if (currentConfig.last_updated) {
  const lastUpdated = new Date(currentConfig.last_updated).getTime();
  const now = new Date().getTime();
  const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 3) {
    console.log('Schedule was updated less than 3 days ago. Oscillation guard active.');
    process.exit(0);
  }
}

// Telemetry Logic
let prVelocity = 0;
try {
  const log = execSync('gh pr list --state merged --json mergedAt -q ". | length"', { stdio: 'pipe' }).toString().trim();
  prVelocity = parseInt(log, 10) || 0;
} catch (e) {
  console.log('Could not read PR telemetry, assuming 0 PRs.');
}

let newSchedule = "0 3 * * 1"; // infrequent tier
let reason = "Low churn based on telemetry (fallback)";

if (prVelocity >= 10) {
  newSchedule = "0 */4 * * *"; // high
  reason = "High PR velocity (>10 merged PRs)";
} else if (prVelocity >= 5) {
  newSchedule = "0 */8 * * *"; // active
  reason = "Active PR velocity (5-10 merged PRs)";
} else if (prVelocity >= 2) {
  newSchedule = "0 0 * * *"; // standard
  reason = "Standard PR velocity (2-4 merged PRs)";
} else if (prVelocity === 1) {
  newSchedule = "0 3 * * 1"; // infrequent
  reason = "Low-churn PR velocity (1 merged PR)";
} else {
  newSchedule = "0 0 1 * *"; // dormant
  reason = "Dormant PR velocity (0 merged PRs)";
}

// Find quietest hour based on git log
try {
  const log = execSync('git log --format=%aI', { stdio: 'pipe' }).toString().trim();
  if (log) {
    const hours = log.split('\n').filter(Boolean).map(dateStr => new Date(dateStr).getUTCHours());
    const counts = Array(24).fill(0);
    hours.forEach(h => counts[h]++);
    let minHour = 0;
    for (let i = 1; i < 24; i++) {
      if (counts[i] < counts[minHour]) minHour = i;
    }
    // Modify schedule to trigger right before quiet hour
    if (newSchedule === "0 0 * * *") {
        newSchedule = `0 ${minHour} * * *`;
    } else if (newSchedule === "0 3 * * 1") {
        newSchedule = `0 ${minHour} * * 1`;
    }
  }
} catch (e) {}

if (newSchedule === currentConfig.schedule) {
  console.log('Schedule unchanged.');
  process.exit(0);
}

const newConfig = {
  schedule: newSchedule,
  reason: reason,
  last_updated: new Date().toISOString()
};

fs.writeFileSync(CONFIG_PATH, yaml.dump(newConfig));
console.log(`Updated schedule to ${newSchedule}`);

// Inline update of the workflow file using the marker
const workflowPath = '.github/workflows/self-heal.yml';
if (fs.existsSync(workflowPath)) {
  let content = fs.readFileSync(workflowPath, 'utf8');
  content = content.replace(/cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);

  // Validation
  try {
    yaml.load(content);
    fs.writeFileSync(workflowPath, content);
    console.log('Updated self-heal.yml with new schedule.');
  } catch (e) {
    console.error('Failed to validate modified workflow file:', e);
    process.exit(1);
  }
} else {
  console.log('Workflow file not found, skipping inline update.');
}

process.exit(0);

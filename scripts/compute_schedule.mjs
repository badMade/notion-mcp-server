#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function getCommitCount(days) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateStr = since.toISOString();
    const count = execSync(`git log --since="${dateStr}" --oneline | wc -l`).toString().trim();
    return parseInt(count, 10) || 0;
  } catch (error) {
    return 0;
  }
}

function computeSchedule(commitsInLast7Days) {
  let schedule = '0 5 * * 1'; // default standard
  let rationale = 'Default fallback schedule.';

  if (commitsInLast7Days > 50) {
    schedule = '0 */4 * * *';
    rationale = 'High velocity detected (>50 commits/wk). Scheduling every 4 hours.';
  } else if (commitsInLast7Days > 20) {
    schedule = '0 */12 * * *';
    rationale = 'Active velocity detected (>20 commits/wk). Scheduling twice a day.';
  } else if (commitsInLast7Days > 5) {
    schedule = '0 5 * * *';
    rationale = 'Standard velocity detected. Scheduling once a day.';
  } else {
    schedule = '0 5 * * 1';
    rationale = 'Low/dormant velocity detected. Scheduling weekly.';
  }

  return { schedule, rationale };
}

function main() {
  console.log('Computing new self-heal schedule based on telemetry...');

  // Read existing schedule metadata to prevent thrashing
  let existingScheduleData = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const fileContents = fs.readFileSync(SCHEDULE_FILE, 'utf8');
      existingScheduleData = yaml.load(fileContents);
    } catch (err) {
      console.warn('Could not parse existing schedule metadata.');
    }
  }

  if (existingScheduleData.last_updated) {
    const lastUpdate = new Date(existingScheduleData.last_updated);
    const now = new Date();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

    // Oscillation Guard: Don't recompute if updated less than 48 hours ago
    if (diffHours < 48) {
      console.log('Schedule was updated recently. Skipping recompute to avoid thrashing.');
      process.exit(0);
    }
  }

  const commitsInLast7Days = getCommitCount(7);
  console.log(`Commits in last 7 days: ${commitsInLast7Days}`);

  const { schedule: newSchedule, rationale } = computeSchedule(commitsInLast7Days);
  console.log(`Computed Schedule: ${newSchedule}`);
  console.log(`Rationale: ${rationale}`);

  if (existingScheduleData.schedule === newSchedule) {
     console.log('Schedule unchanged. No updates needed.');
     process.exit(0);
  }

  // Update .github/self-heal-schedule.yml
  const newMetadata = {
    schedule: newSchedule,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newMetadata));
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Update .github/workflows/self-heal.yml using js-yaml for round-trip safety
  if (fs.existsSync(WORKFLOW_FILE)) {
    const wfContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    try {
      const wfYaml = yaml.load(wfContent);
      if (wfYaml && wfYaml.on && wfYaml.on.schedule && wfYaml.on.schedule[0]) {
        wfYaml.on.schedule[0].cron = newSchedule;
        fs.writeFileSync(WORKFLOW_FILE, yaml.dump(wfYaml));
        console.log(`Updated ${WORKFLOW_FILE} with new schedule.`);
      }
    } catch (e) {
      console.error(`Failed to parse/update ${WORKFLOW_FILE} via yaml:`, e.message);
      // Fallback: sed using an alternate delimiter
      execSync(`sed -i "s|cron:.*# AUTO-UPDATED|cron: '${newSchedule}' # AUTO-UPDATED|" ${WORKFLOW_FILE}`);
      console.log(`Applied fallback sed update to ${WORKFLOW_FILE}.`);
    }
  } else {
    console.warn(`${WORKFLOW_FILE} not found. Cannot inject schedule.`);
  }

  // Verify parseability
  try {
     yaml.load(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
     console.log('YAML parseability check passed.');
  } catch (e) {
     console.error('CRITICAL: Workflow YAML is no longer valid!', e.message);
     process.exit(1);
  }
}

main();

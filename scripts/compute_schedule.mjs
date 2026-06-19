#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = path.join(process.cwd(), '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(process.cwd(), '.github', 'workflows', 'self-heal.yml');

// Telemetry helpers
const execGH = (command) => {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
};

const getRecentPRs = () => {
  const output = execGH('gh pr list --state merged --json mergedAt --limit 100');
  if (!output) return [];
  try {
    return JSON.parse(output);
  } catch (e) {
    return [];
  }
};

const getCommitHours = () => {
  try {
    const output = execSync('git log --format=%aI', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const hours = new Array(24).fill(0);
    output.split('\n').forEach(line => {
      if (line.trim()) {
        const date = new Date(line.trim());
        if (!isNaN(date.getHours())) {
          hours[date.getHours()]++;
        }
      }
    });
    return hours;
  } catch (e) {
    return new Array(24).fill(0);
  }
};

const findQuietestWindow = (hours) => {
  let minWindow = 0;
  let minCommits = Infinity;
  for (let i = 0; i < 24; i++) {
    // Check 4-hour window
    let windowCommits = 0;
    for (let j = 0; j < 4; j++) {
      windowCommits += hours[(i + j) % 24];
    }
    if (windowCommits < minCommits) {
      minCommits = windowCommits;
      minWindow = i;
    }
  }
  return minWindow; // The start of the quietest 4-hour window
};

const main = () => {
  let existingConfig = {};
  try {
    const fileContent = readFileSync(SCHEDULE_FILE, 'utf8');
    existingConfig = yaml.load(fileContent);
  } catch (e) {
    existingConfig = {
      LAST_UPDATED: new Date(0).toISOString(),
      SCHEDULE: "0 0 * * *",
      RATIONALE: "Initial default schedule."
    };
  }

  const lastUpdated = new Date(existingConfig.LAST_UPDATED || 0);
  const now = new Date();
  const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);

  // Oscillation guard: skip if updated within last 3 days
  if (daysSinceUpdate < 3) {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago. Skipping to prevent oscillation.`);
    process.exit(0);
  }

  console.log("Analyzing telemetry...");
  const prs = getRecentPRs();
  const commitHours = getCommitHours();
  const quietestHour = findQuietestWindow(commitHours);

  let newSchedule = "";
  let rationale = "";

  if (prs.length > 50) {
    newSchedule = `0 ${quietestHour},${(quietestHour + 6) % 24},${(quietestHour + 12) % 24},${(quietestHour + 18) % 24} * * *`;
    rationale = `High PR velocity detected (>50 recent PRs). Scheduled 4 times a day during quietest periods.`;
  } else if (prs.length > 20) {
    newSchedule = `0 ${quietestHour},${(quietestHour + 12) % 24} * * *`;
    rationale = `Active PR velocity detected. Scheduled twice daily starting at quietest period (${quietestHour}:00).`;
  } else if (prs.length > 5) {
    newSchedule = `0 ${quietestHour} * * *`;
    rationale = `Standard PR velocity. Scheduled daily at quietest hour (${quietestHour}:00).`;
  } else {
    // Low/dormant: weekly at quietest hour on Sunday
    newSchedule = `0 ${quietestHour} * * 0`;
    rationale = `Low PR velocity detected. Scheduled weekly on Sunday at ${quietestHour}:00.`;
  }

  if (newSchedule === existingConfig.SCHEDULE) {
    console.log("Computed schedule matches existing. No update needed.");
    process.exit(0);
  }

  console.log(`Updating schedule to ${newSchedule}`);

  existingConfig.SCHEDULE = newSchedule;
  existingConfig.RATIONALE = rationale;
  existingConfig.LAST_UPDATED = now.toISOString();

  const yamlStr = yaml.dump(existingConfig, { forceQuotes: true });

  // Apply `# AUTO-UPDATED` inline marker to config file
  const lines = yamlStr.split('\n').map(line => {
    if (line.startsWith('SCHEDULE:')) {
      return `${line} # AUTO-UPDATED`;
    }
    return line;
  });

  writeFileSync(SCHEDULE_FILE, lines.join('\n'));

  // Update workflow file
  try {
    let workflowContent = readFileSync(WORKFLOW_FILE, 'utf8');
    workflowContent = workflowContent.replace(/- cron: .+# AUTO-UPDATED/, `- cron: "${newSchedule}" # AUTO-UPDATED`);
    writeFileSync(WORKFLOW_FILE, workflowContent);
  } catch (e) {
    console.error(`Failed to update workflow file: ${e.message}`);
  }

  console.log("Schedule updated successfully.");
};

main();

#!/usr/bin/env node

/**
 * Script to dynamically compute the self-healing schedule based on telemetry.
 * Safe YAML updates using js-yaml.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const SCHEDULE_FILE = path.join('.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join('.github', 'workflows', 'self-heal.yml');
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function getTelemetry() {
  try {
    const prCount = execSync('gh pr list --state merged --json mergedAt -L 100', { stdio: 'pipe' }).toString();
    const prs = JSON.parse(prCount);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentPRs = prs.filter(pr => new Date(pr.mergedAt) > oneWeekAgo).length;
    return recentPRs;
  } catch (e) {
    console.warn("Could not fetch PR telemetry. Defaulting to 0 PRs.");
    return 0;
  }
}

function computeSchedule(recentPRs) {
  if (recentPRs > 20) {
    return { cron: "0 */6 * * *", rationale: "High velocity (>20 PRs/week). Running every 6 hours." };
  } else if (recentPRs > 5) {
    return { cron: "0 0,12 * * *", rationale: "Active velocity (6-20 PRs/week). Running twice daily." };
  } else if (recentPRs > 0) {
    return { cron: "0 0 * * *", rationale: "Standard velocity (1-5 PRs/week). Running daily at midnight." };
  } else {
    return { cron: "0 0 * * 0", rationale: "Dormant velocity (0 PRs/week). Running weekly on Sunday." };
  }
}

function main() {
  console.log('Computing new schedule...');
  let currentConfig = { SCHEDULE: "0 0 * * *", RATIONALE: "Fallback", LAST_UPDATED: 0 };

  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const content = fs.readFileSync(SCHEDULE_FILE, 'utf8');
      const parsed = yaml.load(content);
      if (parsed) currentConfig = { ...currentConfig, ...parsed };
    } catch (e) {
      console.warn("Could not parse schedule file, using defaults.");
    }
  }

  const now = Date.now();
  if (now - currentConfig.LAST_UPDATED < MIN_UPDATE_INTERVAL_MS) {
    console.log("Oscillation guard active: Last update was less than 3 days ago. Skipping update.");
    process.exit(0);
  }

  const recentPRs = getTelemetry();
  const newSchedule = computeSchedule(recentPRs);

  if (newSchedule.cron === currentConfig.SCHEDULE) {
    console.log(`Schedule unchanged (${newSchedule.cron}). Rationale: ${newSchedule.rationale}.`);
    process.exit(0);
  }

  console.log(`Updating schedule to ${newSchedule.cron}. Rationale: ${newSchedule.rationale}`);

  // 1. Update the metadata file
  const newConfig = {
    SCHEDULE: newSchedule.cron,
    RATIONALE: newSchedule.rationale,
    LAST_UPDATED: now
  };

  // Custom dump to keep comments or just standard dump
  const yamlContent = yaml.dump(newConfig, { forceQuotes: true });
  const finalContent = `# This file contains the current schedule for the self-healing workflow.\n# It is updated automatically by scripts/compute_schedule.mjs based on telemetry.\n# If you edit this manually, the automation will respect your changes until it feels a recomputation is necessary (e.g. significant PR velocity changes).\n${yamlContent}`;

  fs.writeFileSync(SCHEDULE_FILE, finalContent, 'utf8');

  // 2. Safely inject into workflow
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    // Regex matches `- cron: "..." # AUTO-UPDATED`
    const updatedWorkflow = workflowContent.replace(
      /- cron: "[^"]+" # AUTO-UPDATED/,
      `- cron: "${newSchedule.cron}" # AUTO-UPDATED`
    );
    fs.writeFileSync(WORKFLOW_FILE, updatedWorkflow, 'utf8');
    console.log('Updated workflow file.');
  } else {
    console.warn('Workflow file not found to update!');
  }
}

main();

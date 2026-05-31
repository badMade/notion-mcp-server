#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import yaml from "js-yaml";
import path from "node:path";

// Paths
const SCHEDULE_FILE_PATH = path.resolve(".github/self-heal-schedule.yml");
const WORKFLOW_FILE_PATH = path.resolve(".github/workflows/self-heal.yml");

function computeNewSchedule() {
  try {
    // Get commit timestamps over last 30 days
    const logOutput = execSync("git log --since='30 days ago' --format=%aI", { encoding: "utf8" }).trim();
    if (!logOutput) {
      return "0 0 1 * *"; // Dormant -> Monthly
    }

    const commits = logOutput.split("\n");
    const commitCount = commits.length;

    // Find quietest hour based on commit history
    const hourCounts = new Array(24).fill(0);
    for (const ts of commits) {
      const d = new Date(ts);
      hourCounts[d.getUTCHours()]++;
    }

    // Find quietest contiguous window (simplification: find hour with minimum commits)
    let quietestHour = 0;
    let minCount = hourCounts[0];
    for(let i = 1; i < 24; i++) {
        if(hourCounts[i] < minCount) {
            minCount = hourCounts[i];
            quietestHour = i;
        }
    }

    let cron = `0 ${quietestHour} * * 1`; // Default low-churn

    // Dormant: 0 commits -> one run per month (1 0 1 * *) (Handled above)
    // Low-churn: < 10 commits -> one run per week
    if (commitCount < 10) {
      cron = `0 ${quietestHour} * * 1`;
    } else if (commitCount < 50) {
      // Standard: 10 - 50 commits -> twice a week
      cron = `0 ${quietestHour} * * 1,4`;
    } else if (commitCount < 150) {
      // Active: 50 - 150 commits -> daily
      cron = `0 ${quietestHour} * * *`;
    } else {
      // High: > 150 commits -> every 12 hours
      const secondHour = (quietestHour + 12) % 24;
      cron = `0 ${Math.min(quietestHour, secondHour)},${Math.max(quietestHour, secondHour)} * * *`;
    }

    return cron;
  } catch (error) {
    console.error("Error collecting telemetry, falling back to low-churn schedule:", error.message);
    return "0 0 * * 1";
  }
}

function run() {
  console.log("Computing new self-heal schedule...");

  let currentConfig = { schedule: "0 0 * * 1", LAST_UPDATED: new Date(0).toISOString() };
  if (fs.existsSync(SCHEDULE_FILE_PATH)) {
    const fileContent = fs.readFileSync(SCHEDULE_FILE_PATH, "utf8");
    currentConfig = yaml.load(fileContent);
  }

  const lastUpdated = new Date(currentConfig.LAST_UPDATED);
  const now = new Date();

  // Oscillation guard: skip if updated less than 3 days ago
  const diffTime = Math.abs(now - lastUpdated);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 3) {
    console.log("Schedule updated recently. Skipping computation.");
    process.exit(0);
  }

  const newSchedule = computeNewSchedule();

  if (newSchedule === currentConfig.schedule) {
    console.log("Schedule unchanged. Exiting.");
    process.exit(0);
  }

  console.log(`Updating schedule from ${currentConfig.schedule} to ${newSchedule}`);

  // Write new config to self-heal-schedule.yml
  const newConfig = {
    schedule: newSchedule,
    rationale: "Automatically computed based on git commit telemetry over a 30 day lookback window. Quietest contiguous window used to determine optimal run time.",
    LAST_UPDATED: now.toISOString()
  };
  fs.writeFileSync(SCHEDULE_FILE_PATH, yaml.dump(newConfig, { forceQuotes: true }));

  // Update self-heal.yml workflow inline marker
  if (fs.existsSync(WORKFLOW_FILE_PATH)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE_PATH, "utf8");
    // Replace the exact line with the # AUTO-UPDATED marker
    const regex = /cron: ".*" # AUTO-UPDATED/g;
    workflowContent = workflowContent.replace(regex, `cron: "${newSchedule}" # AUTO-UPDATED`);
    fs.writeFileSync(WORKFLOW_FILE_PATH, workflowContent);
  }

  console.log("Schedule updated successfully.");
}

run();
#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";

// Helper to run commands
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const main = () => {
  console.log("Computing self-heal schedule based on telemetry...");

  // 1. Analyze Git history for activity
  // Look at the last 50 commits to find the most common active hour
  const gitLog = run("git log -n 50 --format='%aI'");
  let activeHour = 3; // Default 3 AM

  if (gitLog) {
    const hours = gitLog.split("\n")
      .filter(Boolean)
      .map(dateStr => new Date(dateStr).getUTCHours());

    if (hours.length > 0) {
      const counts = {};
      let maxCount = 0;
      hours.forEach(h => {
        counts[h] = (counts[h] || 0) + 1;
        if (counts[h] > maxCount) {
          maxCount = counts[h];
          activeHour = h;
        }
      });
    }
  }

  // 2. Compute the tier based on activity
  // Simulating telemetry-based tiering. If there are recent commits, we go more frequent.
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentCommits = run(`git log --since="${oneWeekAgo}" --format=oneline`) || "";
  const commitCount = recentCommits.split("\n").filter(Boolean).length;

  let cronExpression = "";
  let tier = "";

  if (commitCount > 20) {
    tier = "high";
    cronExpression = `0 ${activeHour},${(activeHour + 12) % 24} * * *`; // Twice a day
  } else if (commitCount > 5) {
    tier = "active";
    cronExpression = `0 ${activeHour} * * *`; // Once a day
  } else if (commitCount > 0) {
    tier = "standard";
    cronExpression = `0 ${activeHour} * * 1,4`; // Twice a week
  } else {
    tier = "dormant";
    cronExpression = `0 ${activeHour} * * 1`; // Once a week
  }

  // Offset the run to be *before* the active hour
  const runHour = (activeHour - 1 + 24) % 24;
  cronExpression = cronExpression.replace(new RegExp(` ${activeHour} `), ` ${runHour} `);

  console.log(`Determined tier: ${tier}, Cron: ${cronExpression}`);

  // 3. Load or initialize schedule config
  let scheduleConfig = {
    schedule: cronExpression,
    rationale: `Tier: ${tier}. Most active around ${activeHour}:00 UTC. Scheduled for ${runHour}:00 UTC.`,
    last_updated: new Date().toISOString()
  };

  try {
    const existing = yaml.load(readFileSync(SCHEDULE_FILE, "utf8"));
    if (existing && typeof existing === 'object') {
      // Check oscillation guard: don't update if it was updated in the last 3 days
      const lastUpdate = new Date(existing.last_updated || 0);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate < 3 && existing.schedule !== cronExpression) {
        console.log("Schedule updated too recently. Skipping to prevent oscillation.");
        scheduleConfig = existing;
      } else {
        scheduleConfig = { ...existing, schedule: cronExpression, rationale: `Tier: ${tier}. Most active around ${activeHour}:00 UTC. Scheduled for ${runHour}:00 UTC.`, last_updated: new Date().toISOString() };
      }
    }
  } catch (err) {
    // File doesn't exist or invalid YAML, we will create/overwrite
  }

  // 4. Write back to file safely
  writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleConfig));
  console.log(`Successfully wrote schedule to ${SCHEDULE_FILE}`);
};

main();

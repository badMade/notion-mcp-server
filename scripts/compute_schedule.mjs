#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";

// Helper to safely execute commands
function runCmd(command) {
  try {
    return execSync(command, { stdio: "pipe" }).toString().trim();
  } catch (error) {
    return "";
  }
}

// Telemetry gathering
function gatherTelemetry() {
  console.log("Gathering telemetry...");

  // Need explicitly to not rely on gh cli in case it's not available,
  // we'll try gh first, fallback to git logs if needed for PR approximation
  let recentCommits = 0;
  let prVelocity = "standard";

  try {
    const commitLog = runCmd('git log --since="7 days ago" --oneline');
    recentCommits = commitLog ? commitLog.split("\n").length : 0;
  } catch (e) {
    console.error("Failed to fetch commit log");
  }

  console.log(`Commits in last 7 days: ${recentCommits}`);

  if (recentCommits > 50) prVelocity = "high";
  else if (recentCommits > 20) prVelocity = "active";
  else if (recentCommits > 5) prVelocity = "standard";
  else if (recentCommits > 0) prVelocity = "low-churn";
  else prVelocity = "dormant";

  console.log(`Computed PR Velocity: ${prVelocity}`);
  return { recentCommits, prVelocity };
}

// Map velocity to cron schedule
function computeSchedule(velocity) {
  const tiers = {
    "high": "0 */4 * * *",        // Every 4 hours
    "active": "0 */8 * * *",      // Every 8 hours
    "standard": "0 0 * * *",      // Daily at midnight
    "low-churn": "0 0 * * 0",     // Weekly on Sunday
    "dormant": "0 0 1 * *"        // Monthly on the 1st
  };
  return tiers[velocity] || tiers["standard"];
}

async function main() {
  let currentConfig = { schedule: "0 0 * * *", last_updated: 0, rationale: "" };

  try {
    const fileContent = await fs.readFile(SCHEDULE_FILE, "utf-8");
    currentConfig = yaml.load(fileContent) || currentConfig;
  } catch (err) {
    console.log("No existing schedule file found. Bootstrapping...");
  }

  // Oscillation Guard: Skip if updated within 3 days (259,200,000 ms)
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  if (now - currentConfig.last_updated < THREE_DAYS_MS) {
    console.log("Schedule updated recently (< 3 days). Skipping recompute.");
    process.exit(0);
  }

  const { prVelocity, recentCommits } = gatherTelemetry();
  const newSchedule = computeSchedule(prVelocity);
  const rationale = `Velocity is ${prVelocity} based on ${recentCommits} commits in the last 7 days.`;

  if (newSchedule === currentConfig.schedule) {
    console.log("Schedule remains unchanged. No updates needed.");
    process.exit(0);
  }

  console.log(`Updating schedule to: ${newSchedule}`);

  const newConfig = {
    schedule: newSchedule,
    last_updated: now,
    rationale
  };

  const yamlStr = yaml.dump(newConfig, { forceQuotes: true });
  await fs.writeFile(SCHEDULE_FILE, yamlStr);
  console.log(`Successfully updated ${SCHEDULE_FILE}`);
}

main().catch(err => {
  console.error("Error computing schedule:", err);
  process.exit(1);
});

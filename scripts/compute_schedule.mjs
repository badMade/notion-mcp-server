#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Analyzes telemetry and updates .github/self-heal-schedule.yml if necessary.
 * Avoids thrashing by enforcing a 3-day minimum update interval.
 */

import fs from "fs";
import { execSync } from "child_process";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";
const WORKFLOW_FILE = ".github/workflows/self-heal.yml";
const MIN_UPDATE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const log = (msg) => console.log(`[ComputeSchedule] ${msg}`);
const err = (msg) => console.error(`[ComputeSchedule] Error: ${msg}`);

const getSafeCommandOutput = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const main = () => {
  let currentScheduleData = {};
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const content = fs.readFileSync(SCHEDULE_FILE, "utf8");
      currentScheduleData = yaml.load(content);
    } catch (e) {
      log("Could not parse existing schedule file, will recreate.");
    }
  }

  const lastUpdatedStr = currentScheduleData.last_updated;
  if (lastUpdatedStr) {
    const lastUpdated = new Date(lastUpdatedStr).getTime();
    if (!isNaN(lastUpdated) && Date.now() - lastUpdated < MIN_UPDATE_INTERVAL_MS) {
      log("Schedule was updated recently. Skipping recomputation to avoid thrashing.");
      process.exit(0);
    }
  }

  // Telemetry gathering
  // Fallback defaults if no GH CLI or minimal history
  let commitsLast7Days = 0;
  try {
    const commitCountStr = getSafeCommandOutput("git rev-list --count --since='7 days ago' HEAD");
    commitsLast7Days = parseInt(commitCountStr, 10) || 0;
  } catch (e) {
    log("Failed to get commit count, using default.");
  }

  log(`Commits in last 7 days: ${commitsLast7Days}`);

  let tier = "standard";
  let schedule = "0 2 * * *"; // Standard tier: once a day at 2am
  let rationale = "Standard tier due to moderate commit velocity.";

  if (commitsLast7Days > 50) {
    tier = "high";
    schedule = "0 */6 * * *"; // Every 6 hours
    rationale = "High tier due to high commit velocity (>50 commits/week).";
  } else if (commitsLast7Days > 20) {
    tier = "active";
    schedule = "0 */12 * * *"; // Every 12 hours
    rationale = "Active tier due to active commit velocity (>20 commits/week).";
  } else if (commitsLast7Days < 5) {
    tier = "dormant";
    schedule = "0 0 * * 0"; // Once a week
    rationale = "Dormant tier due to low commit velocity (<5 commits/week).";
  }

  if (currentScheduleData.schedule === schedule) {
    log(`Computed schedule ${schedule} matches existing. No update needed.`);
    // Update timestamp anyway so we don't re-run the heavy logic until next interval
    currentScheduleData.last_updated = new Date().toISOString();
    fs.writeFileSync(SCHEDULE_FILE, yaml.dump(currentScheduleData, { forceQuotes: true }));
    process.exit(0);
  }

  log(`New schedule computed: ${schedule}`);

  const newScheduleData = {
    schedule: schedule,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newScheduleData, { forceQuotes: true }));

  // Also update the workflow file inline using regex to safely replace the marker
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, "utf8");
    // Replace the schedule string that is on the same line as `# AUTO-UPDATED`
    // Match something like: `- cron: "0 0 * * *" # AUTO-UPDATED`
    const regex = /-\s*cron:\s*['"][^'"]+['"]\s*#\s*AUTO-UPDATED/g;
    if (regex.test(workflowContent)) {
      workflowContent = workflowContent.replace(regex, `- cron: "${schedule}" # AUTO-UPDATED`);
      fs.writeFileSync(WORKFLOW_FILE, workflowContent);
      log("Updated workflow file inline marker.");
    } else {
      log("Could not find '# AUTO-UPDATED' marker in workflow file.");
    }
  }

  log("Schedule updated successfully.");
};

main();

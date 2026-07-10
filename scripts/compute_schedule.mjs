#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

console.log("Computing self-heal schedule...");

const SCHEDULE_FILE = path.join(".github", "self-heal-schedule.yml");
const WORKFLOW_FILE = path.join(".github", "workflows", "self-heal.yml");

// Basic telemetry extraction
function getCommitCount() {
  try {
    return parseInt(execSync("git rev-list --count HEAD --since='1 month ago'", { encoding: "utf8" }).trim(), 10) || 0;
  } catch {
    return 10; // Fallback
  }
}

// Telemetry extraction for more complex rules
function getPRVelocity() {
  try {
    const prs = execSync("gh pr list --state merged --json mergedAt -q 'length'", { encoding: "utf8" }).trim();
    return parseInt(prs, 10) || 0;
  } catch {
    return 5; // Fallback
  }
}

function getCommitVelocity() {
  try {
    return parseInt(execSync("git rev-list --count HEAD --since='1 month ago'", { encoding: "utf8" }).trim(), 10) || 0;
  } catch {
    return 10; // Fallback
  }
}

// Compute tier based on PR and commit velocity
const commits = getCommitVelocity();
const prs = getPRVelocity();
let schedule;
let rationale;

if (prs > 20 || commits > 100) {
  schedule = "0 */4 * * *";
  rationale = "High PR velocity (>20 PRs or >100 commits/mo). Running every 4 hours.";
} else if (prs > 5 || commits > 30) {
  schedule = "0 8,14,20 * * *";
  rationale = "Active PR velocity (5-20 PRs or 30-100 commits/mo). Running 3 times daily.";
} else if (prs > 0 || commits > 5) {
  schedule = "0 8 * * *";
  rationale = "Standard PR velocity. Running once daily.";
} else {
  schedule = "0 0 * * 1";
  rationale = "Dormant PR velocity. Running once weekly.";
}

console.log(`Determined schedule: ${schedule}`);
console.log(`Rationale: ${rationale}`);

// Oscillation Guard
if (fs.existsSync(SCHEDULE_FILE)) {
  try {
    const currentData = yaml.load(fs.readFileSync(SCHEDULE_FILE, "utf8"));
    if (currentData.schedule === schedule) {
      console.log("Schedule unchanged. Exiting.");
      process.exit(0);
    }
    const lastUpdate = currentData.last_updated ? new Date(currentData.last_updated).getTime() : 0;
    const now = Date.now();
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 3) {
      console.log(`Skipping update. Last updated ${daysSinceUpdate.toFixed(1)} days ago (Oscillation guard).`);
      process.exit(0);
    }
  } catch (err) {
    console.error("Error reading current schedule:", err);
  }
}

// Write the new schedule configuration to .github/self-heal-schedule.yml
const scheduleData = {
  schedule: schedule,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

fs.writeFileSync(
  SCHEDULE_FILE,
  yaml.dump(scheduleData, { forceQuotes: true }) + "\n# AUTO-UPDATED\n"
);
console.log(`Wrote schedule data to ${SCHEDULE_FILE}`);

// Update .github/workflows/self-heal.yml if it exists
if (fs.existsSync(WORKFLOW_FILE)) {
  let content = fs.readFileSync(WORKFLOW_FILE, "utf8");
  // Update the cron line using regex
  content = content.replace(
    /cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/g,
    `cron: "${schedule}" # AUTO-UPDATED`
  );
  fs.writeFileSync(WORKFLOW_FILE, content);
  console.log(`Updated workflow file ${WORKFLOW_FILE}`);
} else {
  console.log(`${WORKFLOW_FILE} does not exist yet; it will be created with the correct schedule.`);
}

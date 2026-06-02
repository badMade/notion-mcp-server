#!/usr/bin/env node

import fs from "fs";
import { execSync } from "child_process";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";
const WORKFLOW_FILE = ".github/workflows/self-heal.yml";

/**
 * Parses stdout from an exec command
 */
function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/**
 * Gathers basic telemetry (PR and commit counts in the last 30 days)
 */
function gatherTelemetry() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Try counting recent commits
  let commitCount = 0;
  const commits = getCommandOutput(`git log --since="30 days ago" --oneline | wc -l`);
  if (commits) commitCount = parseInt(commits, 10);

  // Return telemetry
  return {
    commitCount,
  };
}

/**
 * Computes a cron expression and a rationale based on telemetry
 */
function computeSchedule(telemetry) {
  const { commitCount } = telemetry;

  if (commitCount > 50) {
    return {
      cron: "0 */12 * * *",
      rationale: "High commit velocity detected. Running every 12 hours.",
    };
  } else if (commitCount > 10) {
    return {
      cron: "0 0 * * *",
      rationale: "Moderate commit velocity detected. Running daily.",
    };
  } else {
    return {
      cron: "0 0 * * 0",
      rationale: "Low commit velocity detected. Running weekly.",
    };
  }
}

/**
 * Updates the schedule metadata file and the workflow file.
 */
function updateFiles(newCron, rationale) {
  // 1. Update .github/self-heal-schedule.yml
  const newMetadata = {
    schedule: newCron,
    rationale,
    last_updated: new Date().toISOString()
  };

  const yamlContent = yaml.dump(newMetadata, { forceQuotes: true });
  fs.writeFileSync(SCHEDULE_FILE, yamlContent);
  console.log(`Updated ${SCHEDULE_FILE}`);

  // 2. Update .github/workflows/self-heal.yml
  let workflowContent = fs.readFileSync(WORKFLOW_FILE, "utf8");
  // Replace the cron schedule line that is marked with # AUTO-UPDATED
  const updatedWorkflowContent = workflowContent.replace(
    /- cron:\s*".*?"\s*# AUTO-UPDATED/,
    `- cron: "${newCron}" # AUTO-UPDATED`
  );

  if (workflowContent !== updatedWorkflowContent) {
    fs.writeFileSync(WORKFLOW_FILE, updatedWorkflowContent);
    console.log(`Updated ${WORKFLOW_FILE}`);
  }
}

function main() {
  console.log("Gathering telemetry...");
  const telemetry = gatherTelemetry();
  console.log("Telemetry:", telemetry);

  const { cron, rationale } = computeSchedule(telemetry);
  console.log(`Computed Schedule: ${cron}`);
  console.log(`Rationale: ${rationale}`);

  // Check if schedule is actually changing to avoid PR thrashing.
  // We ONLY update if the new cron is DIFFERENT from the current cron.
  if (fs.existsSync(SCHEDULE_FILE)) {
    const existing = fs.readFileSync(SCHEDULE_FILE, "utf8");
    const parsed = yaml.load(existing);
    if (parsed && parsed.schedule === cron) {
       console.log("Computed schedule is identical to current schedule. Skipping update to avoid no-op PRs.");
       process.exit(0);
    }
  }

  // Also implement an oscillation guard: Don't update if we just updated within the last 3 days
  if (fs.existsSync(SCHEDULE_FILE)) {
    const existing = fs.readFileSync(SCHEDULE_FILE, "utf8");
    const parsed = yaml.load(existing);
    if (parsed && parsed.last_updated) {
      const lastUpdated = new Date(parsed.last_updated);
      const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 3) {
         console.log("Schedule was updated recently (less than 3 days ago). Skipping update to prevent oscillation.");
         process.exit(0);
      }
    }
  }

  updateFiles(cron, rationale);
}

main();

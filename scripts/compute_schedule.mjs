#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";

// Helper to run shell commands safely
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function computeSchedule() {
  console.log("Gathering telemetry...");

  // In a real environment, we'd use gh cli to get telemetry.
  // For bootstrapping, we use fallback defaults if gh fails or history is limited.
  let prsMerged = 0;
  let commits = 0;
  try {
    const prs = runCmd('gh pr list --state merged --json mergedAt --limit 100');
    if (prs) {
       prsMerged = JSON.parse(prs).length;
    }
    const logCount = runCmd('git rev-list --count HEAD');
    if (logCount) {
       commits = parseInt(logCount, 10);
    }
  } catch {
    console.log("Telemetry check failed, using fallback.");
  }

  // Determine schedule
  let schedule = "0 0 * * 0"; // Default: dormant (Weekly on Sunday)
  let rationale = "Default dormant schedule";

  if (prsMerged > 20 || commits > 50) {
    schedule = "0 */4 * * *"; // High
    rationale = "High PR/commit velocity detected";
  } else if (prsMerged > 10 || commits > 20) {
    schedule = "0 */8 * * *"; // Active
    rationale = "Active PR/commit velocity detected";
  } else if (prsMerged > 5 || commits > 10) {
    schedule = "0 0 * * *"; // Standard
    rationale = "Standard PR/commit velocity detected";
  } else if (prsMerged > 0 || commits > 0) {
    schedule = "0 0 * * 0"; // Low-churn
    rationale = "Low-churn PR/commit velocity detected";
  }

  console.log(`Computed Schedule: ${schedule}`);
  console.log(`Rationale: ${rationale}`);

  let currentData = {};
  try {
    const fileContent = await fs.readFile(SCHEDULE_FILE, "utf8");
    currentData = yaml.load(fileContent) || {};
  } catch {
    // File might not exist
  }

  // Oscillation guard: only update if changed
  if (currentData.SELFHEAL_SCHEDULE === schedule) {
    console.log("Schedule unchanged. Exiting.");
    process.exit(0);
  }

  const newData = {
    SELFHEAL_SCHEDULE: schedule,
    RATIONALE: rationale,
    LAST_UPDATED: new Date().toISOString(),
  };

  const yamlStr = yaml.dump(newData, { forceQuotes: true });

  // Add inline marker for sed fallback if needed
  const finalStr = yamlStr.replace(
    /SELFHEAL_SCHEDULE: (.*)/,
    "SELFHEAL_SCHEDULE: $1 # AUTO-UPDATED"
  );

  await fs.writeFile(SCHEDULE_FILE, finalStr);
  console.log(`Successfully updated ${SCHEDULE_FILE}`);
}

computeSchedule().catch((err) => {
  console.error("Error computing schedule:", err);
  process.exit(1);
});

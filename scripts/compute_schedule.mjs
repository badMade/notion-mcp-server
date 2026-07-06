#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Computes an optimal self-healing schedule dynamically based on project telemetry
 * (using the GitHub CLI to query PR velocity, CI failures, etc.).
 * Updates the target schedule file using `js-yaml` for safe round-tripping.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";

function safeExec(cmd, fallback = "") {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (error) {
    return fallback;
  }
}

// Ensure directory exists
const targetDir = path.dirname(SCHEDULE_FILE);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let existingScheduleData = {};
if (fs.existsSync(SCHEDULE_FILE)) {
  try {
    existingScheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE, "utf8")) || {};
  } catch (e) {
    console.error("Failed to parse existing schedule file.", e);
  }
}

const lastUpdated = existingScheduleData.last_updated ? new Date(existingScheduleData.last_updated).getTime() : 0;
const now = Date.now();
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

if (now - lastUpdated < THREE_DAYS) {
  console.log("Schedule was updated recently. Skipping recompute to prevent oscillation.");
  process.exit(0);
}

console.log("Gathering telemetry for schedule computation...");

// Note: Ensure `gh` CLI and `jq` are available in Actions for telemetry
// Fetch merged PRs in the last 30 days
const prsJson = safeExec(`gh pr list --state merged --json mergedAt --limit 100`, "[]");
let prCount = 0;
let prTimestamps = [];
try {
  const prs = JSON.parse(prsJson);
  const thirtyDaysAgo = now - THIRTY_DAYS;
  const recentPRs = prs.filter(pr => new Date(pr.mergedAt).getTime() > thirtyDaysAgo);
  prCount = recentPRs.length;
  prTimestamps = recentPRs.map(pr => new Date(pr.mergedAt).getHours());
} catch (e) {
  console.error("Error parsing PR telemetry:", e.message);
}

// Fetch recent self-heal PRs to track failure/success loops
const selfHealPrsJson = safeExec(`gh pr list --label self-heal --state merged --json title --limit 10`, "[]");
let selfHealCount = 0;
try {
  selfHealCount = JSON.parse(selfHealPrsJson).length;
} catch (e) {
  console.error("Error parsing self-heal PR telemetry:", e.message);
}

console.log(`Telemetry: ${prCount} PRs merged in the last 30 days. ${selfHealCount} recent self-heal PRs merged.`);

// Compute the quietest contiguous window
let bestHour = 3; // Default 3 AM
if (prTimestamps.length > 0) {
  const hourCounts = new Array(24).fill(0);
  prTimestamps.forEach(hour => hourCounts[hour]++);

  let minCount = Infinity;
  for (let i = 0; i < 24; i++) {
    // Sliding window of 3 hours
    const count = hourCounts[i] + hourCounts[(i + 1) % 24] + hourCounts[(i + 2) % 24];
    if (count < minCount) {
      minCount = count;
      bestHour = i;
    }
  }
}
console.log(`Computed best quiet hour to schedule: ${bestHour}`);

let cadenceTier = "standard";
let cronExpr = `0 ${bestHour} * * *`; // standard: daily at best hour
let rationale = `Standard cadence due to moderate PR velocity (${prCount} PRs/mo). Scheduled at quietest hour (${bestHour}).`;

if (prCount > 30) {
  cadenceTier = "high";
  cronExpr = `0 ${bestHour},${(bestHour + 6) % 24},${(bestHour + 12) % 24},${(bestHour + 18) % 24} * * *`; // Every 6 hours starting at best hour
  rationale = `High cadence due to high PR velocity (${prCount} PRs/mo).`;
} else if (prCount > 15) {
  cadenceTier = "active";
  cronExpr = `0 ${bestHour},${(bestHour + 12) % 24} * * *`; // Every 12 hours starting at best hour
  rationale = `Active cadence due to frequent PRs (${prCount} PRs/mo).`;
} else if (prCount < 5) {
  cadenceTier = "low-churn";
  cronExpr = `0 ${bestHour} * * 1`; // Weekly on Mondays at best hour
  rationale = `Infrequent cadence due to low churn (${prCount} PRs/mo).`;
}

if (prCount === 0) {
  cadenceTier = "dormant";
  cronExpr = `0 ${bestHour} 1 * *`; // Monthly on the 1st
  rationale = `Dormant cadence due to 0 PRs recently.`;
}

if (existingScheduleData.schedule === cronExpr) {
  console.log("Computed schedule matches existing schedule. Skipping update.");
  process.exit(0);
}

console.log(`Determined Tier: ${cadenceTier} -> Cron: ${cronExpr}`);
console.log(`Rationale: ${rationale}`);

// Load or create schedule object
let scheduleData = {
  schedule: cronExpr,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData), "utf8");
console.log(`Successfully updated ${SCHEDULE_FILE}`);

// Also update the workflow file inline using simple regex, since GitHub Actions format
// might lose comments/formatting if strictly serialized with yaml.dump
const WORKFLOW_FILE = ".github/workflows/self-heal.yml";
if (fs.existsSync(WORKFLOW_FILE)) {
  let content = fs.readFileSync(WORKFLOW_FILE, "utf8");
  // Replace the cron schedule safely matching the marker
  // Use alternate delimiter if cronExpr contains slashes or asterisks by avoiding sed,
  // we do string replacement in JS so it's safe.
  content = content.replace(/cron:\s*['"]?[^'"\n]+['"]?\s*# AUTO-UPDATED/g, `cron: '${cronExpr}' # AUTO-UPDATED`);
  fs.writeFileSync(WORKFLOW_FILE, content, "utf8");
  console.log(`Successfully updated cron expression in ${WORKFLOW_FILE}`);
} else {
  console.log(`Workflow file ${WORKFLOW_FILE} does not exist yet; will be created soon.`);
}

#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import yaml from "js-yaml";

// Telemetry Logic
function getCommitCount(days = 7) {
  try {
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = execSync(`git log --since="${since}" --format=oneline`)
      .toString()
      .trim();
    if (!result) return 0;
    return result.split("\n").length;
  } catch (err) {
    return 0; // fallback if git fails
  }
}

// Very basic active period detection (mock for hour of least commits)
function getQuietHour() {
  try {
    const dates = execSync("git log --format=%aI")
      .toString()
      .trim()
      .split("\n");
    if (!dates || dates.length === 0 || dates[0] === "") return 0;

    const hours = new Array(24).fill(0);
    for (const d of dates) {
      if (!d) continue;
      const dateObj = new Date(d);
      if (!isNaN(dateObj.getTime())) {
        hours[dateObj.getHours()]++;
      }
    }

    // Find hour with min commits
    let minHour = 0;
    let minCount = Infinity;
    for (let i = 0; i < 24; i++) {
      if (hours[i] < minCount) {
        minCount = hours[i];
        minHour = i;
      }
    }
    return minHour;
  } catch (err) {
    return 0; // default to midnight
  }
}

// Compute new cadence
function computeSchedule() {
  const commitCount = getCommitCount(14); // Look back 14 days
  const velocity = commitCount / 14;
  const quietHour = getQuietHour();

  let schedule = `0 ${quietHour} * * *`; // Default: Rare/Infrequent (once a day)
  let rationale = `Low activity (${velocity.toFixed(2)} commits/day). Running daily at hour ${quietHour}.`;

  if (velocity > 5) {
    schedule = `0 ${quietHour},${(quietHour + 8) % 24},${(quietHour + 16) % 24} * * *`;
    rationale = `High activity (${velocity.toFixed(2)} commits/day). Running 3x daily.`;
  } else if (velocity > 2) {
    schedule = `0 ${quietHour},${(quietHour + 12) % 24} * * *`;
    rationale = `Active (${velocity.toFixed(2)} commits/day). Running 2x daily.`;
  } else if (velocity < 0.2) {
    schedule = `0 ${quietHour} * * 1`; // Once a week
    rationale = `Dormant (${velocity.toFixed(2)} commits/day). Running weekly on Monday.`;
  }

  return { schedule, rationale };
}

// Update schedule file
function updateScheduleFile(schedule, rationale) {
  const schedulePath = path.join(
    process.cwd(),
    ".github",
    "self-heal-schedule.yml",
  );
  let data = {};

  if (existsSync(schedulePath)) {
    try {
      const fileContents = readFileSync(schedulePath, "utf8");
      data = yaml.load(fileContents) || {};
    } catch (e) {
      console.warn("Could not parse existing schedule file, creating new one.");
    }
  }

  // Oscillation guard: skip if updated in the last 3 days
  if (data.last_updated) {
    const lastUpdate = new Date(data.last_updated).getTime();
    const now = Date.now();
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 3) {
      console.log(
        `\n=> Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago (less than 3 days). Skipping recompute to avoid oscillation.`,
      );
      return false;
    }
  }

  // If no change, return false
  if (data.schedule === schedule && data.rationale === rationale) {
    return false;
  }

  data.schedule = schedule;
  data.rationale = rationale;
  data.last_updated = new Date().toISOString();

  // Make sure we output valid yaml, and quote strings if needed
  const newYaml = yaml.dump(data, { forceQuotes: true });
  writeFileSync(schedulePath, newYaml + "\n# AUTO-UPDATED\n", "utf8");
  return true;
}

// Update Workflow file
function updateWorkflowFile(newSchedule) {
  const workflowPath = path.join(
    process.cwd(),
    ".github",
    "workflows",
    "self-heal.yml",
  );
  if (!existsSync(workflowPath)) return false;

  let content = readFileSync(workflowPath, "utf8");

  // Replace the cron schedule in the workflow file.
  // It anchors on the `# AUTO-UPDATED` comment.
  const scheduleRegex = /cron:\s*['"]?.*['"]?\s*# AUTO-UPDATED/;
  const replacement = `cron: "${newSchedule}" # AUTO-UPDATED`;

  if (scheduleRegex.test(content)) {
    const updatedContent = content.replace(scheduleRegex, replacement);
    if (content !== updatedContent) {
      writeFileSync(workflowPath, updatedContent, "utf8");
      return true;
    }
  }
  return false;
}

async function main() {
  console.log("=== Computing Self-Heal Schedule ===");
  const { schedule, rationale } = computeSchedule();
  console.log(`Computed Schedule: "${schedule}"`);
  console.log(`Rationale: ${rationale}`);

  const changedData = updateScheduleFile(schedule, rationale);
  const changedWf = updateWorkflowFile(schedule);

  if (changedData || changedWf) {
    console.log("\n✅ Schedule updated. Changes need to be committed.");
    process.exit(0);
  } else {
    console.log("\n✅ Schedule unchanged.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

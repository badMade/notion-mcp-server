#!/usr/bin/env node

/**
 * compute_schedule.mjs
 * Computes the optimal self-healing schedule based on telemetry
 * and updates .github/self-heal-schedule.yml using js-yaml.
 */

import fs from "node:fs";
import yaml from "js-yaml";
import { execSync } from "node:child_process";

const SCHEDULE_FILE = ".github/self-heal-schedule.yml";

// Helper to run GH CLI safely
function getGhTelemetry(command) {
  try {
    return JSON.parse(execSync(`gh ${command}`, { encoding: "utf8" }));
  } catch (err) {
    console.error(`GH CLI failed for '${command}'. Assuming minimal activity.`);
    return [];
  }
}

function getCommitCount(daysAgo) {
  try {
    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const count = execSync(`git rev-list --count HEAD --since="${since}"`, { encoding: "utf8" }).trim();
    return parseInt(count, 10);
  } catch (e) {
    return 0;
  }
}

function computeSchedule() {
  const prs = getGhTelemetry("pr list --state merged --json mergedAt --limit 100");
  const recentCommits = getCommitCount(7);

  let newSchedule = "0 0 * * *"; // default: daily
  let rationale = "Standard activity tier.";

  if (recentCommits > 50 || prs.length > 20) {
    newSchedule = "0 */6 * * *"; // every 6 hours
    rationale = "High activity tier: >50 commits or >20 merged PRs recently.";
  } else if (recentCommits > 10 || prs.length > 5) {
    newSchedule = "0 */12 * * *"; // every 12 hours
    rationale = "Active tier: moderate commit/PR velocity.";
  } else if (recentCommits === 0 && prs.length === 0) {
    newSchedule = "0 0 * * 1"; // Weekly
    rationale = "Dormant tier: negligible activity in recent window.";
  }

  return { newSchedule, rationale };
}

function main() {
  console.log("Computing self-healing schedule...");

  let currentConfig = { schedule: "0 0 * * *", last_updated: new Date(0).toISOString() };
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      currentConfig = yaml.load(fs.readFileSync(SCHEDULE_FILE, "utf8"));
    }
  } catch (err) {
    console.warn(`Could not read ${SCHEDULE_FILE}, starting fresh.`);
  }

  // Oscillation guard: only update if older than 3 days
  const lastUpdated = new Date(currentConfig.last_updated || 0);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 3) {
    console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago. Skipping to prevent thrashing.`);
    process.exit(0);
  }

  const { newSchedule, rationale } = computeSchedule();

  if (currentConfig.schedule !== newSchedule || currentConfig.rationale !== rationale) {
    console.log(`Updating schedule to: ${newSchedule} (${rationale})`);

    // We add # AUTO-UPDATED manually because js-yaml dump drops inline comments
    const updatedYaml = yaml.dump({
      schedule: newSchedule,
      rationale,
      last_updated: new Date().toISOString()
    }, { forceQuotes: true });

    // Append inline comment using a simple string replace
    const finalContent = updatedYaml.replace(/^schedule:.*$/m, (match) => `${match} # AUTO-UPDATED`);

    fs.writeFileSync(SCHEDULE_FILE, finalContent, "utf8");
    console.log(`Updated ${SCHEDULE_FILE}`);
  } else {
    console.log("Schedule is already optimal. No changes made.");
  }
}

main();
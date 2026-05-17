#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const SCHEDULE_FILE_PATH = path.join(process.cwd(), ".github", "self-heal-schedule.yml");
const WORKFLOW_FILE_PATH = path.join(process.cwd(), ".github", "workflows", "self-heal.yml");

/**
 * Executes a git command and returns the output as an array of strings.
 *
 * @param {string} command - Git command to run.
 * @returns {string[]} Array of output lines.
 */
function getGitOutput(command) {
  try {
    const output = execSync(command, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim();
    return output ? output.split("\n") : [];
  } catch (e) {
    return [];
  }
}

/**
 * Computes a cron expression based on recent commit activity.
 *
 * @returns {string} The computed cron expression.
 */
function computeSchedule() {
  // 1. Telemetry: PR/Commit frequency over the last 14 days
  const commits = getGitOutput(`git log --since="14 days ago" --format="%aI"`);

  if (commits.length === 0) {
    return { cron: "0 0 * * 1", rationale: "Dormant: 1 run per week (Monday at 00:00)" }; // Rare
  } else if (commits.length < 5) {
    return { cron: "0 0 * * 1,4", rationale: "Low-churn: 2 runs per week (Mon, Thu)" }; // Infrequent
  } else if (commits.length < 20) {
    return { cron: "0 2 * * *", rationale: "Standard: 1 run per day at 02:00" }; // Moderate
  } else if (commits.length < 50) {
    return { cron: "0 2,14 * * *", rationale: "Active: 2 runs per day (02:00, 14:00)" }; // Frequent
  } else {
    return { cron: "0 */4 * * *", rationale: "High velocity: Every 4 hours" }; // High
  }
}

/**
 * Updates the schedule YAML files if necessary.
 */
function updateSchedule() {
  const { cron, rationale } = computeSchedule();

  let currentConfig = {};
  if (fs.existsSync(SCHEDULE_FILE_PATH)) {
    try {
      currentConfig = yaml.load(fs.readFileSync(SCHEDULE_FILE_PATH, "utf8")) || {};
    } catch (e) {
      console.error("Failed to parse existing schedule file.", e);
    }
  }

  // Determine if it changed
  if (currentConfig.schedule === cron && currentConfig.rationale === rationale) {
    console.log("Schedule is optimal. No changes needed.");
    process.exit(0);
  }

  console.log(`Updating schedule to: ${cron} (${rationale})`);

  // Write .github/self-heal-schedule.yml
  const newConfig = {
    schedule: cron,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  const yamlStr = yaml.dump(newConfig);
  fs.writeFileSync(SCHEDULE_FILE_PATH, yamlStr, "utf8");

  // Update .github/workflows/self-heal.yml
  if (fs.existsSync(WORKFLOW_FILE_PATH)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE_PATH, "utf8");
    // Regex to match the scheduled cron line with the # AUTO-UPDATED marker
    const cronRegex = /-\s*cron:\s*['"][^'"]+['"]\s*#\s*AUTO-UPDATED/;

    if (cronRegex.test(workflowContent)) {
       workflowContent = workflowContent.replace(cronRegex, `- cron: '${cron}' # AUTO-UPDATED`);
       fs.writeFileSync(WORKFLOW_FILE_PATH, workflowContent, "utf8");
       console.log("Updated workflow file.");
    } else {
       console.warn("Could not find the '# AUTO-UPDATED' marker in self-heal.yml");
    }
  }

  // Ensure there's a diff so the workflow knows to PR
  console.log("Schedule updated successfully.");
}

updateSchedule();

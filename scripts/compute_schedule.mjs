#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';
const MIN_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function runCommand(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (err) {
    return null;
  }
}

async function computeSchedule() {
  console.log("Computing new schedule based on telemetry...");

  // Guard: Schedule oscillation guard
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const scheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      if (scheduleData && scheduleData.last_updated) {
        const lastUpdated = new Date(scheduleData.last_updated).getTime();
        const now = Date.now();
        if (now - lastUpdated < MIN_UPDATE_INTERVAL_MS) {
          console.log("Schedule updated recently. Skipping computation to prevent oscillation.");
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to parse existing schedule file, proceeding with compute.", err);
    }
  }

  // Telemetry: PR frequency and commit frequency
  const prLogs = runCommand("gh pr list --state merged --json mergedAt --limit 50 2>/dev/null") || "[]";
  let prs = [];
  try {
     prs = JSON.parse(prLogs);
  } catch (e) {}

  let cadenceTier = "infrequent";
  let scheduleExpr = "0 3 * * 0"; // Default: Weekly on Sunday at 3 AM
  let rationale = "Default low-activity fallback";

  if (prs.length > 20) {
     cadenceTier = "high";
     scheduleExpr = "0 */12 * * *"; // Every 12 hours
     rationale = "High PR velocity detected (>20 recently merged PRs)";
  } else if (prs.length > 10) {
     cadenceTier = "active";
     scheduleExpr = "0 3 * * 1-5"; // Weekdays at 3 AM
     rationale = "Active PR velocity detected (10-20 recently merged PRs)";
  } else if (prs.length > 0) {
     cadenceTier = "standard";
     scheduleExpr = "0 3 * * 1,4"; // Mondays and Thursdays
     rationale = "Standard PR velocity detected (<10 recently merged PRs)";
  }

  // Generate updated schedule data
  const newScheduleData = {
    schedule: scheduleExpr,
    cadence_tier: cadenceTier,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  console.log(`Computed Schedule: ${scheduleExpr}`);
  console.log(`Rationale: ${rationale}`);

  // Write new metadata file safely
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newScheduleData));
  console.log(`Updated ${SCHEDULE_FILE}`);

  // Update workflow file using Node.js parsing validation check instead of raw sed for primary path
  if (fs.existsSync(WORKFLOW_FILE)) {
    let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');

    // Replace the schedule marker
    const regex = /cron:\s*'.*?'\s*# AUTO-UPDATED/;
    const replacement = `cron: '${scheduleExpr}' # AUTO-UPDATED`;

    if (regex.test(workflowContent)) {
      const newContent = workflowContent.replace(regex, replacement);

      // Parse validation check to ensure valid YAML
      try {
        yaml.load(newContent);
        fs.writeFileSync(WORKFLOW_FILE, newContent);
        console.log(`Updated schedule in ${WORKFLOW_FILE}`);
      } catch (e) {
        console.error("YAML parsing validation failed after schedule update:", e);
        process.exit(1);
      }
    } else {
      console.warn(`Could not find `# AUTO-UPDATED` marker in ${WORKFLOW_FILE}. Make sure it exists!`);
    }
  } else {
    console.warn(`Workflow file ${WORKFLOW_FILE} does not exist yet.`);
  }
}

computeSchedule().catch(err => {
  console.error(err);
  process.exit(1);
});

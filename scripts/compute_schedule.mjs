#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

async function updateSchedule() {
  const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
  const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

  let currentScheduleData;
  try {
    const rawYaml = await fs.readFile(SCHEDULE_FILE, 'utf8');
    currentScheduleData = yaml.load(rawYaml);
  } catch (err) {
    console.error(`Could not read ${SCHEDULE_FILE}:`, err.message);
    process.exit(1);
  }

  // Oscillation guard: skip if updated recently (e.g. less than 3 days ago)
  if (currentScheduleData.LAST_UPDATED) {
    const lastUpdate = new Date(currentScheduleData.LAST_UPDATED);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 3) {
      console.log('Schedule updated recently. Skipping recompute to avoid oscillation.');
      process.exit(0);
    }
  }

  // Gather Telemetry
  let commitCount = 0;
  let prMergeCount = 0;
  try {
    // Look back ~7 days
    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Commit count
    const commitsStr = execSync(`git rev-list --count HEAD --since="${sinceDate}"`, { encoding: 'utf-8' });
    commitCount = parseInt(commitsStr.trim(), 10) || 0;

    // Attempt to get PR count if GH CLI is available
    try {
      const prData = execSync(`gh pr list --state merged --search "merged:>=${sinceDate}" --json mergedAt -q "length"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      prMergeCount = parseInt(prData.trim(), 10) || 0;
    } catch (e) {
      console.log('GH CLI failed or unavailable, using commit count proxy for PRs');
      prMergeCount = Math.floor(commitCount / 3); // rough estimate
    }
  } catch (err) {
    console.warn('Could not collect full telemetry, using defaults.', err.message);
  }

  let newCron = "0 0 * * *"; // default: daily
  let rationale = "Default daily cadence based on standard activity.";

  if (prMergeCount > 10 || commitCount > 30) {
    newCron = "0 */4 * * *"; // high churn: every 4 hours
    rationale = "High PR velocity detected. Running every 4 hours.";
  } else if (prMergeCount > 5 || commitCount > 10) {
    newCron = "0 */12 * * *"; // active: every 12 hours
    rationale = "Moderate activity detected. Running twice daily.";
  } else if (commitCount === 0) {
    newCron = "0 0 * * 0"; // dormant: weekly
    rationale = "Repository appears dormant. Running weekly.";
  }

  if (currentScheduleData.SCHEDULE === newCron) {
    console.log('Calculated schedule matches current schedule. No update needed.');
    process.exit(0);
  }

  console.log(`Updating schedule from ${currentScheduleData.SCHEDULE} to ${newCron}`);

  // Update schedule tracker
  const newScheduleData = {
    SCHEDULE: newCron,
    LAST_UPDATED: new Date().toISOString(),
    RATIONALE: rationale
  };

  const yamlOut = yaml.dump(newScheduleData, { forceQuotes: true });
  await fs.writeFile(SCHEDULE_FILE, yamlOut, 'utf8');

  // Update workflow file using regex replacement strictly anchored
  const workflowContent = await fs.readFile(WORKFLOW_FILE, 'utf8');
  // Replaces `- cron: "..." # AUTO-UPDATED`
  const updatedWorkflow = workflowContent.replace(
    /- cron: ".*" # AUTO-UPDATED/,
    `- cron: "${newCron}" # AUTO-UPDATED`
  );

  await fs.writeFile(WORKFLOW_FILE, updatedWorkflow, 'utf8');
  console.log('Schedule updated successfully.');
}

updateSchedule().catch(err => {
  console.error('Failed to compute schedule:', err);
  process.exit(1);
});

#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SCHEDULE_FILE = path.join(rootDir, '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(rootDir, '.github', 'workflows', 'self-heal.yml');

// Get PR merge frequency
function getMergeFrequency() {
  try {
    // 30 days lookback
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // Wrap gh command in try-catch in case it's missing or no auth
    const result = execSync(`gh pr list --state merged --json mergedAt --search "merged:>=${since}"`, { cwd: rootDir }).toString();
    const prs = JSON.parse(result);
    return prs.length;
  } catch {
    return -1; // Fallback
  }
}

function determineCadence(prCount) {
  if (prCount < 0) return { schedule: '0 0 * * *', rationale: 'Fallback due to missing telemetry' };
  if (prCount > 50) return { schedule: '0 */4 * * *', rationale: 'High PR velocity (every 4 hours)' };
  if (prCount > 20) return { schedule: '0 */8 * * *', rationale: 'Active PR velocity (every 8 hours)' };
  if (prCount > 5)  return { schedule: '0 12 * * *', rationale: 'Standard PR velocity (once a day)' };
  if (prCount > 0)  return { schedule: '0 0 * * 1,4', rationale: 'Low-churn PR velocity (twice a week)' };
  return { schedule: '0 0 * * 1', rationale: 'Dormant PR velocity (once a week)' };
}

function main() {
  // Check oscillation guard
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      const scheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      if (scheduleData.last_updated) {
        const lastUpdated = new Date(scheduleData.last_updated);
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) {
          console.log(`Schedule was updated ${daysSinceUpdate.toFixed(1)} days ago. Skipping recompute to prevent oscillation.`);
          process.exit(0);
        }
      }
    } catch (e) {
      console.warn("Failed to read previous schedule data, proceeding with recompute.");
    }
  }

  const prCount = getMergeFrequency();
  const { schedule, rationale } = determineCadence(prCount);

  console.log(`Computed new schedule: ${schedule} (${rationale})`);

  // Update schedule metadata file
  const scheduleData = {
    schedule,
    rationale,
    last_updated: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData));

  // Safely update the workflow YAML using js-yaml if it exists
  if (fs.existsSync(WORKFLOW_FILE)) {
    try {
      const workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');

      // Use regex replacement anchored by the marker for safety
      const updatedContent = workflowContent.replace(
        /- cron:\s*['"]?.*['"]?\s*# AUTO-UPDATED/g,
        `- cron: '${schedule}' # AUTO-UPDATED`
      );

      // Validate parseable YAML before writing
      yaml.load(updatedContent);
      fs.writeFileSync(WORKFLOW_FILE, updatedContent);
      console.log(`Updated workflow file: ${WORKFLOW_FILE}`);
    } catch (e) {
      console.error("Failed to update workflow YAML safely:", e);
      process.exit(1);
    }
  } else {
    console.warn(`Workflow file not found at ${WORKFLOW_FILE}`);
  }
}

main();

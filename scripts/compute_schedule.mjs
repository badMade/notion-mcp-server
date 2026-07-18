#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const SCHEDULE_FILE_PATH = path.join(process.cwd(), '.github/self-heal-schedule.yml');
const WORKFLOW_FILE_PATH = path.join(process.cwd(), '.github/workflows/self-heal.yml');

function runGitOrGhCommandSafe(command, defaultValue = '') {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return defaultValue;
  }
}

function calculateCadence() {
  // Mocking telemetry for now since some GH API commands might fail if not authenticated or not in a git repo with remotes
  // Ideally we would look at PR merge frequency, etc.

  const mergeCountStr = runGitOrGhCommandSafe("gh pr list --state merged --json mergedAt | jq length", "10");
  const mergeCount = parseInt(mergeCountStr, 10) || 0;

  if (mergeCount > 50) return { tier: 'high', cron: '0 */4 * * *', reason: 'High PR velocity detected.' };
  if (mergeCount > 20) return { tier: 'active', cron: '0 */8 * * *', reason: 'Active PR velocity detected.' };
  if (mergeCount > 5) return { tier: 'standard', cron: '0 0 * * *', reason: 'Standard PR velocity detected.' };
  if (mergeCount > 1) return { tier: 'low-churn', cron: '0 0 * * 1', reason: 'Low-churn PR velocity detected.' };
  return { tier: 'dormant', cron: '0 0 1 * *', reason: 'Dormant repository detected.' };
}

function main() {
  console.log('Computing new schedule based on telemetry...');

  let currentScheduleData = {};
  if (fs.existsSync(SCHEDULE_FILE_PATH)) {
    try {
      currentScheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE_PATH, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing schedule file. Creating new.');
    }
  }

  // Schedule oscillation guard (don't update if updated in last 7 days)
  if (currentScheduleData && currentScheduleData.last_updated) {
    const lastUpdate = new Date(currentScheduleData.last_updated);
    const now = new Date();
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) {
      console.log(`Schedule was updated recently (${daysSinceUpdate.toFixed(1)} days ago). Skipping recompute to avoid oscillation.`);
      process.exit(0);
    }
  }

  const { cron, reason } = calculateCadence();

  // If nothing changed, exit
  if (currentScheduleData.schedule === cron) {
    console.log('Schedule unchanged. Exiting.');
    process.exit(0);
  }

  console.log(`New schedule calculated: ${cron} (${reason})`);

  // 1. Update .github/self-heal-schedule.yml
  const newScheduleData = {
    schedule: cron,
    reason: reason,
    last_updated: new Date().toISOString(),
  };

  if (!fs.existsSync(path.dirname(SCHEDULE_FILE_PATH))) {
    fs.mkdirSync(path.dirname(SCHEDULE_FILE_PATH), { recursive: true });
  }

  fs.writeFileSync(SCHEDULE_FILE_PATH, yaml.dump(newScheduleData));
  console.log(`Updated ${SCHEDULE_FILE_PATH}`);

  // 2. Update .github/workflows/self-heal.yml (using safe YAML roundtrip)
  if (fs.existsSync(WORKFLOW_FILE_PATH)) {
    try {
      const workflowContent = fs.readFileSync(WORKFLOW_FILE_PATH, 'utf8');

      // We will attempt to update the schedule using simple string replacement with the # AUTO-UPDATED marker
      // since js-yaml can sometimes strip comments or reformat the file in undesirable ways.

      const lines = workflowContent.split('\n');
      const newLines = lines.map(line => {
        if (line.includes('# AUTO-UPDATED')) {
          // Replace the cron expression part
          return line.replace(/cron:\s*['"][^'"]+['"]/, `cron: '${cron}'`);
        }
        return line;
      });

      const newContent = newLines.join('\n');

      // Validate parseable YAML
      yaml.load(newContent);

      fs.writeFileSync(WORKFLOW_FILE_PATH, newContent);
      console.log(`Updated ${WORKFLOW_FILE_PATH}`);

    } catch (e) {
      console.error('Failed to parse or update workflow YAML.', e);
      process.exit(1);
    }
  }

  console.log('Schedule compute complete.');
}

main();
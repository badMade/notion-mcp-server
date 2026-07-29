#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function getTelemetry() {
  try {
    // We try to use gh cli for PR and run data if available. Otherwise fallback to basic git metrics.
    // If gh cli isn't logged in, these will fail, but that's handled by try-catch.
    let prsMerged = 0;
    let ciFailures = 0;

    try {
      const prData = JSON.parse(execSync('gh pr list --state merged --json mergedAt --limit 100', { stdio: 'pipe' }).toString());
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      prsMerged = prData.filter(pr => new Date(pr.mergedAt) > oneWeekAgo).length;
    } catch(e) {}

    try {
      const runData = JSON.parse(execSync('gh run list --workflow=ci --json conclusion --limit 50', { stdio: 'pipe' }).toString());
      ciFailures = runData.filter(r => r.conclusion === 'failure').length;
    } catch(e) {}

    // Hour of day commit frequency (finding the quietest contiguous window)
    // We look at the last 100 commits
    const hours = new Array(24).fill(0);
    try {
      const commitDates = execSync('git log --format=%aI -n 100', { stdio: 'pipe' }).toString().trim().split('\n');
      for (const d of commitDates) {
        if (!d) continue;
        const hr = new Date(d).getHours();
        if (!isNaN(hr)) hours[hr]++;
      }
    } catch(e) {}

    let quietestHour = 0;
    let minCommits = Infinity;
    for (let i = 0; i < 24; i++) {
      if (hours[i] < minCommits) {
         minCommits = hours[i];
         quietestHour = i;
      }
    }

    return { prsMerged, ciFailures, quietestHour };
  } catch (e) {
    return { prsMerged: 0, ciFailures: 0, quietestHour: 0 };
  }
}

function computeSchedule() {
  const telemetry = getTelemetry();
  let cron = `0 ${telemetry.quietestHour} * * 0`; // rare
  let rationale = 'Dormant activity';

  if (telemetry.prsMerged > 20 || telemetry.ciFailures > 10) {
    cron = `0 */4 * * *`;
    rationale = 'High velocity PR/Failure rate';
  } else if (telemetry.prsMerged > 5 || telemetry.ciFailures > 2) {
    cron = `0 ${telemetry.quietestHour},${(telemetry.quietestHour+12)%24} * * *`;
    rationale = 'Active PR velocity';
  } else if (telemetry.prsMerged > 0 || telemetry.ciFailures > 0) {
    cron = `0 ${telemetry.quietestHour} * * *`;
    rationale = 'Standard PR velocity';
  } else {
    cron = `0 ${telemetry.quietestHour} * * 0`;
    rationale = 'Low-churn/Dormant activity';
  }

  return { cron, rationale };
}

function safelyUpdateYaml(filePath, cron) {
  if (!fs.existsSync(filePath)) return false;

  // To preserve comments (specifically `# AUTO-UPDATED`), we MUST use regex/sed on the string representation.
  // js-yaml does not preserve comments during a round-trip.

  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(/cron:\s*['"][^'"]+['"]\s*# AUTO-UPDATED/, `cron: '${cron}' # AUTO-UPDATED`);

  if (updated !== content) {
    // Validate the resulting YAML is still well-formed before writing
    try {
      yaml.load(updated);
      fs.writeFileSync(filePath, updated);
      return true;
    } catch (e) {
      console.error('Modified YAML is invalid. Skipping update.', e);
      return false;
    }
  }
  return false;
}

async function main() {
  console.log('Computing new schedule...');
  const { cron, rationale } = computeSchedule();
  console.log(`Computed cron: ${cron}`);
  console.log(`Rationale: ${rationale}`);

  let changed = false;

  // Update schedule tracker file
  const scheduleData = {
    schedule: cron,
    rationale: rationale,
    last_updated: new Date().toISOString()
  };

  let oldScheduleData = null;
  if (fs.existsSync(SCHEDULE_FILE)) {
    try {
      oldScheduleData = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    } catch(e) {}
  }

  if (!oldScheduleData || oldScheduleData.schedule !== cron) {
    fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
    // This file doesn't have important inline comments so yaml.dump is fine
    fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData));
    changed = true;
    console.log(`Updated ${SCHEDULE_FILE}`);
  }

  // Update workflow file safely
  if (fs.existsSync(WORKFLOW_FILE)) {
    const wfChanged = safelyUpdateYaml(WORKFLOW_FILE, cron);
    if (wfChanged) {
      changed = true;
      console.log(`Updated ${WORKFLOW_FILE}`);
    }
  }

  if (changed) {
    console.log('Schedule was updated.');
    process.exit(0);
  } else {
    console.log('Schedule unchanged.');
    process.exit(1); // Exit 1 to prevent empty PR for no-op schedule updates
  }
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});

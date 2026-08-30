#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import yaml from 'js-yaml';
import process from 'node:process';

function getGitTelemetry() {
  try {
    // Commit frequency by hour of day
    const log = execSync('git log --format=%aI', { encoding: 'utf-8' });
    const dates = log.split('\\n').filter(Boolean);
    const hours = dates.map(d => new Date(d).getUTCHours());

    // PR frequency and success rate (using gh if available)
    let prs = [];
    try {
      const prData = execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf-8' });
      prs = JSON.parse(prData);
    } catch (e) {
      console.log("Could not fetch PR data, using default/mocked PR telemetry based on git log");
    }

    return { dates, hours, prCount: prs.length };
  } catch (e) {
    console.error("Failed to gather git telemetry", e);
    return { dates: [], hours: [], prCount: 0 };
  }
}

function computeSchedule(telemetry) {
  const { prCount, hours } = telemetry;

  // Find the quietest hour
  const hourCounts = Array(24).fill(0);
  hours.forEach(h => hourCounts[h]++);
  let quietestHour = 0;
  let minCount = Infinity;
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] < minCount) {
      minCount = hourCounts[i];
      quietestHour = i;
    }
  }

  // Determine tier
  let cron = '';
  let rationale = '';
  if (prCount > 50) {
    cron = `0 */4 * * *`;
    rationale = `High PR velocity (${prCount} PRs). Running every 4 hours.`;
  } else if (prCount > 20) {
    cron = `0 */8 * * *`;
    rationale = `Active PR velocity (${prCount} PRs). Running every 8 hours.`;
  } else if (prCount > 5 || hours.length > 20) {
    cron = `0 ${quietestHour} * * *`;
    rationale = `Standard velocity. Running daily at quietest hour ${quietestHour}:00 UTC.`;
  } else {
    cron = `0 ${quietestHour} * * 1`; // Weekly
    rationale = `Low/dormant velocity. Running weekly at quietest hour ${quietestHour}:00 UTC on Monday.`;
  }

  return { cron, rationale };
}

function updateYamlFile(filePath, newCron, rationale) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  // Basic regex replace to preserve `# AUTO-UPDATED` comment which js-yaml might lose
  let newContent;
  if (filePath.includes('self-heal-schedule.yml')) {
    const doc = yaml.load(content) || {};
    doc.schedule = newCron;
    doc.rationale = rationale;
    doc.last_updated = new Date().toISOString();
    newContent = yaml.dump(doc) + '\\n# AUTO-UPDATED\\n';
  } else {
    // Replacing cron in GitHub Actions workflow yaml
    newContent = content.replace(
      /cron:\\s+['"]?.*?['"]?\\s+# AUTO-UPDATED/,
      `cron: '${newCron}' # AUTO-UPDATED`
    );
  }

  fs.writeFileSync(filePath, newContent);
  console.log(`Updated ${filePath}`);
}

function main() {
  const telemetry = getGitTelemetry();
  const { cron, rationale } = computeSchedule(telemetry);

  console.log(`Computed Schedule: ${cron}\\nRationale: ${rationale}`);

  const scheduleFile = '.github/self-heal-schedule.yml';
  const workflowFile = '.github/workflows/self-heal.yml';

  // Only update if they exist. (They might not exist initially, we'll create them)
  if (fs.existsSync(scheduleFile)) {
    const current = yaml.load(fs.readFileSync(scheduleFile, 'utf8')) || {};
    if (current.schedule === cron) {
      console.log('Schedule unchanged. No updates needed.');
      return;
    }
  }

  updateYamlFile(scheduleFile, cron, rationale);
  updateYamlFile(workflowFile, cron, rationale);
}

main();

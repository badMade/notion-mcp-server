#!/usr/bin/env node
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

function getTelemetry() {
  try {
    const gitLogOutput = execSync('git log --format=%aI --since="30 days ago"', { encoding: 'utf-8' });
    const commits = gitLogOutput.split('\n').filter(Boolean);

    let prs = [];
    try {
      const prOutput = execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf-8' });
      prs = JSON.parse(prOutput);
    } catch (e) {
      // Fallback if gh not available
    }

    // Determine quietest hour (0-23)
    const hourCounts = new Array(24).fill(0);
    for (const commit of commits) {
      const date = new Date(commit);
      hourCounts[date.getUTCHours()]++;
    }

    let quietestHour = 0;
    let minCommits = Infinity;
    for (let i = 0; i < 24; i++) {
      if (hourCounts[i] < minCommits) {
        minCommits = hourCounts[i];
        quietestHour = i;
      }
    }

    // Determine cadence tier
    let tier = 'standard';
    const prCount = prs.length;
    if (prCount > 30) tier = 'high';
    else if (prCount > 15) tier = 'active';
    else if (prCount > 5) tier = 'standard';
    else if (prCount > 0) tier = 'low-churn';
    else tier = 'dormant';

    return { quietestHour, tier };
  } catch (e) {
    return { quietestHour: 0, tier: 'standard' };
  }
}

function computeScheduleCron(telemetry) {
  const { quietestHour, tier } = telemetry;

  if (tier === 'high') {
    return `0 */6 * * *`; // Every 6 hours
  } else if (tier === 'active') {
    return `0 */12 * * *`; // Every 12 hours
  } else if (tier === 'standard') {
    return `0 ${quietestHour} * * *`; // Once a day at quietest hour
  } else if (tier === 'low-churn') {
    return `0 ${quietestHour} * * 0,3`; // Twice a week
  } else {
    return `0 ${quietestHour} * * 0`; // Once a week
  }
}

function main() {
  const scheduleFile = '.github/self-heal-schedule.yml';
  let currentDoc = {
    schedule: '0 0 * * *',
    rationale: 'Default initialization',
    last_updated: new Date().toISOString()
  };

  if (fs.existsSync(scheduleFile)) {
    const content = fs.readFileSync(scheduleFile, 'utf8');
    currentDoc = yaml.load(content) || currentDoc;
  }

  // Oscillation guard: skip if updated in last 24h
  if (currentDoc.last_updated) {
    const lastUpdate = new Date(currentDoc.last_updated);
    const now = new Date();
    if (now - lastUpdate < 24 * 60 * 60 * 1000) {
      console.log('Schedule updated recently. Skipping recompute.');
      return;
    }
  }

  const telemetry = getTelemetry();
  const newSchedule = computeScheduleCron(telemetry);

  if (currentDoc.schedule !== newSchedule) {
    console.log(`Updating schedule from '${currentDoc.schedule}' to '${newSchedule}'`);
    currentDoc.schedule = newSchedule;
    currentDoc.rationale = `Telemetry driven: tier=${telemetry.tier}, quietHour=${telemetry.quietestHour}`;
    currentDoc.last_updated = new Date().toISOString();

    let yamlStr = yaml.dump(currentDoc);
    yamlStr += '\n# AUTO-UPDATED\n';
    fs.writeFileSync(scheduleFile, yamlStr);

    const workflowFile = '.github/workflows/self-heal.yml';
    if (fs.existsSync(workflowFile)) {
      let wfContent = fs.readFileSync(workflowFile, 'utf8');
      wfContent = wfContent.replace(
        /cron: ".*" # AUTO-UPDATED/,
        `cron: "${newSchedule}" # AUTO-UPDATED`
      );
      fs.writeFileSync(workflowFile, wfContent);
    }
  } else {
    console.log('Schedule unchanged.');
  }
}

main();

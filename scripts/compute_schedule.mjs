#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

function getTelemetry() {
  let prCount = 0;
  try {
    const prs = JSON.parse(execSync("gh pr list --state merged --json mergedAt --limit 100 2>/dev/null", { encoding: 'utf-8' }));
    prCount = prs.filter(pr => (Date.now() - new Date(pr.mergedAt).getTime()) < 30 * 24 * 60 * 60 * 1000).length;
  } catch (e) {
    console.error("Failed to get PR telemetry, defaulting to 0");
  }

  let quietestHour = 0;
  try {
    const commits = execSync("git log --format=%aI -n 100", { encoding: 'utf-8' }).trim().split('\n');
    const hourCounts = new Array(24).fill(0);
    commits.forEach(c => { if (c) hourCounts[new Date(c).getHours()]++; });
    let minCount = Infinity;
    for (let i = 0; i < 24; i++) {
      if (hourCounts[i] < minCount) { minCount = hourCounts[i]; quietestHour = i; }
    }
  } catch (e) {
    console.error("Failed to get commit telemetry, defaulting hour to 0");
  }

  return { prCount, quietestHour };
}

function computeSchedule(telemetry) {
  const { prCount, quietestHour } = telemetry;
  let cadence = '0 * * * *', tier = 'high';
  if (prCount < 5) { cadence = `0 ${quietestHour} * * 1`; tier = 'dormant'; }
  else if (prCount < 15) { cadence = `0 ${quietestHour} */2 * *`; tier = 'low-churn'; }
  else if (prCount < 30) { cadence = `0 ${quietestHour} * * *`; tier = 'standard'; }
  else if (prCount < 50) { cadence = `0 ${quietestHour},${(quietestHour + 12) % 24} * * *`; tier = 'active'; }
  return { cadence, tier };
}

function updateFiles(schedule) {
  const metaFile = '.github/self-heal-schedule.yml';
  let metaDoc = {};
  if (fs.existsSync(metaFile)) metaDoc = yaml.load(fs.readFileSync(metaFile, 'utf-8')) || {};
  metaDoc.SELFHEAL_SCHEDULE = schedule.cadence;
  metaDoc.tier = schedule.tier;
  metaDoc.last_updated = new Date().toISOString();
  metaDoc.rationale = `Computed based on PR velocity tier: ${schedule.tier}`;

  let newMeta = yaml.dump(metaDoc);
  if (!newMeta.includes('# AUTO-UPDATED')) newMeta = newMeta.replace(/(SELFHEAL_SCHEDULE:.*)/, '$1 # AUTO-UPDATED');
  fs.writeFileSync(metaFile, newMeta);

  const wfFile = '.github/workflows/self-heal.yml';
  if (fs.existsSync(wfFile)) {
    const wfDoc = yaml.load(fs.readFileSync(wfFile, 'utf-8'));
    if (wfDoc?.on?.schedule?.[0]?.cron && wfDoc.on.schedule[0].cron !== schedule.cadence) {
      wfDoc.on.schedule[0].cron = schedule.cadence;
      let newWf = yaml.dump(wfDoc, { lineWidth: -1 });
      newWf = newWf.replace(/(cron:\s*['"]?)([^'"\n]+)(['"]?)/g, `$1$2$3 # AUTO-UPDATED`);
      fs.writeFileSync(wfFile, newWf);
    }
  }
}

updateFiles(computeSchedule(getTelemetry()));

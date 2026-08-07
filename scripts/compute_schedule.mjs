#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function getModeOfInactivity() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString();
    const output = execSync(`git log --since="${sinceStr}" --format="%aI"`).toString().trim();
    if (!output) return 0;

    const commits = output.split('\n');
    const hourCounts = new Array(24).fill(0);
    for (const commit of commits) {
        if (!commit) continue;
        const d = new Date(commit);
        hourCounts[d.getHours()]++;
    }

    let minHour = 0;
    let minCount = hourCounts[0];
    for (let i = 1; i < 24; i++) {
        if (hourCounts[i] < minCount) {
            minCount = hourCounts[i];
            minHour = i;
        }
    }
    return minHour;
  } catch (e) {
    return 0; // Fallback to midnight
  }
}

function getTelemetry() {
  let commitCount = 0;
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString();
    const output = execSync(`git log --since="${sinceStr}" --format="%H"`).toString().trim();
    commitCount = output ? output.split('\n').length : 0;
  } catch (e) {}

  const quietHour = getModeOfInactivity();
  return { commitCount, quietHour };
}

const { commitCount, quietHour } = getTelemetry();
let cronExp = `0 ${quietHour} * * *`;
let rationale = `Standard cadence running at quiet hour ${quietHour} based on moderate activity.`;
let tier = 'standard';

if (commitCount > 100) {
  // High velocity: Run multiple times a day, still anchored at quiet hour
  const h2 = (quietHour + 6) % 24;
  const h3 = (quietHour + 12) % 24;
  const h4 = (quietHour + 18) % 24;
  cronExp = `0 ${quietHour},${h2},${h3},${h4} * * *`;
  rationale = `High cadence (runs 4x/day including quiet hour ${quietHour}) based on >100 commits in last 30 days.`;
  tier = 'high';
} else if (commitCount > 30) {
  const h2 = (quietHour + 12) % 24;
  cronExp = `0 ${quietHour},${h2} * * *`;
  rationale = `Active cadence (runs 2x/day including quiet hour ${quietHour}) based on >30 commits in last 30 days.`;
  tier = 'active';
} else if (commitCount > 5) {
  cronExp = `0 ${quietHour} * * *`;
  rationale = `Standard cadence (runs 1x/day at quiet hour ${quietHour}) based on >5 commits in last 30 days.`;
  tier = 'standard';
} else if (commitCount > 0) {
  cronExp = `0 ${quietHour} * * 0`;
  rationale = `Low-churn cadence (runs 1x/week on Sunday at quiet hour ${quietHour}) based on >0 commits in last 30 days.`;
  tier = 'low-churn';
} else {
  cronExp = `0 ${quietHour} 1 * *`;
  rationale = `Dormant cadence (runs 1x/month on 1st at quiet hour ${quietHour}) based on 0 commits in last 30 days.`;
  tier = 'dormant';
}

const scheduleFile = path.join('.github', 'self-heal-schedule.yml');
let doc = {};
try {
  if (fs.existsSync(scheduleFile)) {
    doc = yaml.load(fs.readFileSync(scheduleFile, 'utf8')) || {};
  }
} catch (e) {
  console.error(e);
}

const prevSchedule = doc.schedule;
if (prevSchedule === cronExp) {
  console.log('Schedule unchanged.');
  process.exit(0);
}

doc.schedule = cronExp;
doc.tier = tier;
doc.rationale = rationale;
doc.lastUpdated = new Date().toISOString();
fs.writeFileSync(scheduleFile, yaml.dump(doc) + '\n# AUTO-UPDATED\n');

const workflowFile = path.join('.github', 'workflows', 'self-heal.yml');
if (fs.existsSync(workflowFile)) {
  try {
    let wfStr = fs.readFileSync(workflowFile, 'utf8');
    const wfDoc = yaml.load(wfStr);

    if (wfDoc.on && wfDoc.on.schedule && Array.isArray(wfDoc.on.schedule)) {
      wfDoc.on.schedule[0].cron = cronExp;
      let newWfStr = yaml.dump(wfDoc);
      newWfStr = newWfStr.replace(`cron: '${cronExp}'`, `cron: '${cronExp}' # AUTO-UPDATED`).replace(`cron: ${cronExp}`, `cron: '${cronExp}' # AUTO-UPDATED`);
      fs.writeFileSync(workflowFile, newWfStr);
    }
  } catch (e) {
    console.error(e);
  }
}

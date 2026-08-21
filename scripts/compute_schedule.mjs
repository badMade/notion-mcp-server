#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

const scheduleFile = '.github/self-heal-schedule.yml';

let doc = {};
if (fs.existsSync(scheduleFile)) {
  const content = fs.readFileSync(scheduleFile, 'utf8');
  doc = yaml.load(content) || {};
}
const currentSchedule = doc.schedule ? doc.schedule.replace(/# AUTO-UPDATED/, '').trim() : '';

let prVelocity = 'standard';
let newSchedule = '0 3 * * *';
let newRationale = 'Standard velocity detected, scheduling daily at 03:00';

try {
  // Get merged PRs in the last 30 days
  const prs = JSON.parse(execSync("gh pr list --state merged --json mergedAt --limit 100", { stdio: 'pipe' }).toString());
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPrs = prs.filter(pr => new Date(pr.mergedAt) > thirtyDaysAgo);
  const prCount = recentPrs.length;

  // Find quietest hour based on commit history
  let quietestHour = 3;
  try {
    const commits = execSync("git log --since='30 days ago' --format='%aI'", { stdio: 'pipe' }).toString().trim().split('\n');
    if (commits.length > 0 && commits[0] !== '') {
      const hourCounts = new Array(24).fill(0);
      commits.forEach(commit => {
        const date = new Date(commit);
        if (!isNaN(date.getTime())) {
          hourCounts[date.getUTCHours()]++;
        }
      });
      let minCount = Infinity;
      for (let i = 0; i < 24; i++) {
        if (hourCounts[i] < minCount) {
          minCount = hourCounts[i];
          quietestHour = i;
        }
      }
    }
  } catch (e) {
    console.log('Failed to detect quietest hour, falling back to default.');
  }

  if (prCount > 20) {
    prVelocity = 'high';
    newSchedule = `0 ${quietestHour},${(quietestHour+6)%24},${(quietestHour+12)%24},${(quietestHour+18)%24} * * *`;
    newRationale = `High velocity (${prCount} PRs in 30 days), scheduling multiple runs starting before quietest hour (${quietestHour}:00 UTC)`;
  } else if (prCount > 10) {
    prVelocity = 'active';
    newSchedule = `0 ${quietestHour},${(quietestHour+12)%24} * * *`;
    newRationale = `Active velocity (${prCount} PRs in 30 days), scheduling twice a day starting before quietest hour (${quietestHour}:00 UTC)`;
  } else if (prCount > 3) {
    prVelocity = 'standard';
    newSchedule = `0 ${quietestHour} * * *`;
    newRationale = `Standard velocity (${prCount} PRs in 30 days), scheduling daily before quietest hour (${quietestHour}:00 UTC)`;
  } else if (prCount > 0) {
    prVelocity = 'low-churn';
    newSchedule = `0 ${quietestHour} * * 1,4`;
    newRationale = `Low churn (${prCount} PRs in 30 days), scheduling twice a week before quietest hour (${quietestHour}:00 UTC)`;
  } else {
    prVelocity = 'dormant';
    newSchedule = `0 ${quietestHour} 1 * *`;
    newRationale = `Dormant (0 PRs in 30 days), scheduling monthly before quietest hour (${quietestHour}:00 UTC)`;
  }
} catch (e) {
  console.log('Telemetry gather failed, using standard fallback');
}

// Only update if schedule actually changes
if (newSchedule !== currentSchedule) {
  doc.schedule = newSchedule;
  doc.rationale = newRationale;
  doc.lastUpdated = new Date().toISOString();

  const yamlString = yaml.dump(doc);
  const finalYaml = yamlString.replace(/schedule:.*\n/, `schedule: "${newSchedule}" # AUTO-UPDATED\n`);

  fs.writeFileSync(scheduleFile, finalYaml);
  console.log(`Updated schedule to ${newSchedule}`);
} else {
  console.log('Schedule unchanged, skipping update.');
}

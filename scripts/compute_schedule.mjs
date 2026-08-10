#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

try {
  let tier = 'standard';
  let hours = Array(24).fill(0);
  try {
    const commits = execSync('git log --format=%aI --since="30 days ago"', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    commits.forEach(d => {
      const h = new Date(d).getHours();
      hours[h]++;
    });
  } catch (e) {}

  let minWindowSum = Infinity;
  let quietStart = 0;
  for (let i = 0; i < 24; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      sum += hours[(i + j) % 24];
    }
    if (sum < minWindowSum) {
      minWindowSum = sum;
      quietStart = i;
    }
  }

  let prs = [];
  try {
    prs = JSON.parse(execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf-8' }));
  } catch (e) {}

  if (prs.length > 20) tier = 'high';
  else if (prs.length > 10) tier = 'active';
  else if (prs.length > 2) tier = 'standard';
  else if (prs.length > 0) tier = 'low-churn';
  else tier = 'dormant';

  let schedule = "0 0 * * *";
  if (tier === 'high') {
    schedule = `0 ${quietStart},${(quietStart+8)%24},${(quietStart+16)%24} * * *`;
  } else if (tier === 'active') {
    schedule = `0 ${quietStart},${(quietStart+12)%24} * * *`;
  } else if (tier === 'standard') {
    schedule = `0 ${quietStart} * * *`;
  } else if (tier === 'low-churn') {
    schedule = `0 ${quietStart} * * 0`;
  } else {
    schedule = `0 ${quietStart} 1 * *`;
  }

  const scheduleFile = '.github/self-heal-schedule.yml';
  let parsed = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));

  if (parsed.schedule !== schedule) {
    parsed.schedule = schedule;
    let dumped = yaml.dump(parsed);
    dumped = dumped.replace(/schedule:\s*(.*)/, 'schedule: $1 # AUTO-UPDATED');
    fs.writeFileSync(scheduleFile, dumped);

    const wfFile = '.github/workflows/self-heal.yml';
    if (fs.existsSync(wfFile)) {
      const wfParsed = yaml.load(fs.readFileSync(wfFile, 'utf8'));
      if (wfParsed && wfParsed.on && wfParsed.on.schedule && wfParsed.on.schedule[0]) {
        wfParsed.on.schedule[0].cron = schedule;
        let wfDumped = yaml.dump(wfParsed, { lineWidth: -1 });
        fs.writeFileSync(wfFile, wfDumped);
      }
    }
    console.log("Schedule updated to " + schedule);
  } else {
    console.log("Schedule unchanged");
  }
} catch (e) {
  console.error("Failed to compute schedule:", e);
}

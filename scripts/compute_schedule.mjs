#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

function getTelemetry() {
  try {
    const prs = JSON.parse(execSync('gh pr list --state merged --json mergedAt', { stdio: 'pipe' }).toString());
    const prCount = prs.length;

    const runs = JSON.parse(execSync('gh run list --workflow=ci --json conclusion', { stdio: 'pipe' }).toString());
    const failures = runs.filter(r => r.conclusion === 'failure').length;

    const commits = execSync('git log --format=%aI -n 100', { stdio: 'pipe' }).toString().trim().split('\n').filter(Boolean);
    const hourCounts = Array(24).fill(0);
    commits.forEach(c => {
      const date = new Date(c);
      if (!isNaN(date.getTime())) hourCounts[date.getHours()]++;
    });

    let quietestHour = 0;
    let minCommits = Infinity;
    for (let i = 0; i < 24; i++) {
      if (hourCounts[i] < minCommits) {
        minCommits = hourCounts[i];
        quietestHour = i;
      }
    }

    let tier = 'standard';
    if (prCount > 50) tier = 'high';
    else if (prCount > 20) tier = 'active';
    else if (prCount < 5) tier = 'low-churn';

    return { tier, quietestHour };
  } catch (e) {
    return { tier: 'standard', quietestHour: 3 };
  }
}

function computeSchedule(telemetry) {
  const h = telemetry.quietestHour;
  switch (telemetry.tier) {
    case 'high': return `0 ${h},${(h+8)%24},${(h+16)%24} * * *`;
    case 'active': return `0 ${h},${(h+12)%24} * * *`;
    case 'standard': return `0 ${h} * * *`;
    case 'low-churn': return `0 ${h} * * 1,4`;
    case 'dormant': return `0 ${h} * * 1`;
    default: return `0 ${h} * * *`;
  }
}

function updateSelfHealWorkflow(newSchedule) {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'self-heal.yml');
  if (!fs.existsSync(workflowPath)) {
    console.error('Self-heal workflow not found');
    return;
  }
  const content = fs.readFileSync(workflowPath, 'utf8');
  let data;
  try {
    data = yaml.load(content);
  } catch (e) {
    console.error('Failed to parse YAML', e);
    return;
  }

  if (data.on && data.on.schedule && data.on.schedule[0]) {
    data.on.schedule[0].cron = newSchedule;
    fs.writeFileSync(workflowPath, yaml.dump(data));
    console.log('Self-heal workflow updated');
  }
}


function main() {
  const telemetry = getTelemetry();
  const schedule = computeSchedule(telemetry);
  const targetPath = path.join(process.cwd(), '.github', 'self-heal-schedule.yml');

  if (!fs.existsSync(targetPath)) {
    console.error('Schedule file not found');
    process.exit(1);
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  let data;
  try {
    data = yaml.load(content);
  } catch (e) {
    console.error('Failed to parse YAML', e);
    process.exit(1);
  }

  const oldSchedule = data.schedule;
  if (schedule === oldSchedule) {
    console.log('Schedule unchanged');
    process.exit(0);
  }

  data.schedule = schedule;
  data.rationale = `Computed tier: ${telemetry.tier}, quietest hour: ${telemetry.quietestHour}`;
  data.last_updated = new Date().toISOString();

  let newContent = yaml.dump(data);
  newContent = newContent.replace(/(schedule:\s*".*?")/, '$1 # AUTO-UPDATED');

  fs.writeFileSync(targetPath, newContent);
  console.log('Schedule updated');
  updateSelfHealWorkflow(schedule);
}

main();
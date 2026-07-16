#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

function run(command) {
  try {
    return execSync(command).toString().trim();
  } catch (error) {
    return '';
  }
}

function getCommitHistory() {
  const log = run('git log --format=%aI --since="30 days ago"');
  if (!log) return [];
  return log.split('\n').filter(Boolean);
}

function getPRHistory() {
  const log = run('gh pr list --state merged --json mergedAt --limit 100');
  if (!log) return [];
  try {
    const data = JSON.parse(log);
    return data.map(pr => pr.mergedAt);
  } catch (e) {
    return [];
  }
}

function getSelfHealHistory() {
  const log = run('gh pr list --label self-heal --json state,createdAt --limit 100');
  if (!log) return [];
  try {
    return JSON.parse(log);
  } catch (e) {
    return [];
  }
}

function calculateSchedule() {
  console.log('Calculating schedule based on telemetry...');
  const commits = getCommitHistory();
  const prs = getPRHistory();

  let prVelocity = 'standard';
  if (prs.length > 50) prVelocity = 'high';
  else if (prs.length > 20) prVelocity = 'active';
  else if (prs.length > 5) prVelocity = 'standard';
  else if (prs.length > 0) prVelocity = 'low-churn';
  else prVelocity = 'dormant';

  let cron = '0 3 * * *'; // default dormant/fallback

  if (prVelocity === 'high') {
    cron = '0 */4 * * *';
  } else if (prVelocity === 'active') {
    cron = '0 */8 * * *';
  } else if (prVelocity === 'standard') {
    cron = '0 2,14 * * *';
  } else if (prVelocity === 'low-churn') {
    cron = '0 2 * * *';
  }

  // Adjust based on consecutive self-heals
  const selfHeals = getSelfHealHistory();
  const sortedHeals = selfHeals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let consecutiveEmpty = 0;
  for (const heal of sortedHeals) {
    if (heal.state === 'CLOSED') consecutiveEmpty++;
    else break;
  }

  if (consecutiveEmpty >= 3 && prVelocity !== 'dormant') {
    console.log('Reducing frequency due to empty self-heals.');
    if (cron === '0 */4 * * *') cron = '0 */8 * * *';
    else if (cron === '0 */8 * * *') cron = '0 2,14 * * *';
    else if (cron === '0 2,14 * * *') cron = '0 2 * * *';
    else if (cron === '0 2 * * *') cron = '0 3 * * *';
  }

  return { cron, prVelocity };
}

function updateScheduleFiles(cron, prVelocity) {
  const scheduleFile = '.github/self-heal-schedule.yml';
  const workflowFile = '.github/workflows/self-heal.yml';

  // Read existing to check last_updated
  if (fs.existsSync(scheduleFile)) {
    try {
      const existing = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
      if (existing && existing.last_updated) {
        const lastUpdate = new Date(existing.last_updated);
        const now = new Date();
        const diffHours = Math.abs(now - lastUpdate) / 36e5;
        if (diffHours < 24) {
          console.log('Schedule updated recently. Skipping recompute to prevent oscillation.');
          return;
        }
      }
    } catch (e) {
      // Ignore parse errors on read, just overwrite
    }
  }

  // Update schedule metadata
  const scheduleData = {
    current_schedule: cron,
    rationale: `Computed based on ${prVelocity} PR velocity`,
    last_updated: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(scheduleFile), { recursive: true });
  fs.writeFileSync(scheduleFile, yaml.dump(scheduleData));
  console.log(`Updated ${scheduleFile}`);

  // Update workflow file safely
  if (fs.existsSync(workflowFile)) {
    let content = fs.readFileSync(workflowFile, 'utf8');
    content = content.replace(/cron:\s*'.*'\s*# AUTO-UPDATED/, `cron: '${cron}' # AUTO-UPDATED`);

    // Validate YAML
    try {
      yaml.load(content);
      fs.writeFileSync(workflowFile, content);
      console.log(`Updated ${workflowFile}`);
    } catch (e) {
      console.error('Generated YAML is invalid, skipping workflow update.', e);
    }
  }
}

function main() {
  const { cron, prVelocity } = calculateSchedule();
  console.log(`Calculated Cron: ${cron} (${prVelocity})`);
  updateScheduleFiles(cron, prVelocity);
}

main();

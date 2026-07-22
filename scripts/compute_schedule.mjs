#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const scheduleFile = '.github/self-heal-schedule.yml';
const workflowFile = '.github/workflows/self-heal.yml';

// Helper to safely run commands
function runCmd(cmd, fallback = '') {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return fallback;
  }
}

// Telemetry gathering
function getTelemetry() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. PR merge frequency
  let mergedPRs = 0;
  try {
    const prsJSON = runCmd(`gh pr list --state merged --json mergedAt --limit 100`);
    if (prsJSON) {
      const prs = JSON.parse(prsJSON);
      mergedPRs = prs.filter(pr => pr.mergedAt && new Date(pr.mergedAt) > new Date(thirtyDaysAgo)).length;
    }
  } catch (e) {}

  // 2. Commit frequency by hour-of-day
  const commitDates = runCmd(`git log --since="30 days ago" --format=%aI`).split('\n').filter(Boolean);
  const hourCounts = new Array(24).fill(0);
  for (const dateStr of commitDates) {
    const date = new Date(dateStr);
    if (!isNaN(date.getHours())) {
      hourCounts[date.getHours()]++;
    }
  }

  // Active period detection: Find quietest contiguous 6-hour window
  let minCommits = Infinity;
  let quietestStartHour = 0;
  for (let i = 0; i < 24; i++) {
    let windowCommits = 0;
    for (let j = 0; j < 6; j++) {
      windowCommits += hourCounts[(i + j) % 24];
    }
    if (windowCommits < minCommits) {
      minCommits = windowCommits;
      quietestStartHour = i;
    }
  }

  // Schedule immediately before quiet window begins
  const optimalHour = (quietestStartHour - 1 + 24) % 24;

  // 3. Selfheal PR success rate (Adjustment triggers)
  let consecutiveEmpty = 0;
  let consecutiveSuccess = 0;
  try {
    const shPrsJSON = runCmd(`gh pr list --state all --label self-heal --json state,createdAt,mergedAt --limit 10`);
    if (shPrsJSON) {
      const shPrs = JSON.parse(shPrsJSON).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      for (const pr of shPrs) {
         if (pr.state === 'MERGED') {
           consecutiveSuccess++;
           consecutiveEmpty = 0;
         } else if (pr.state === 'CLOSED') { // Stale / empty
           consecutiveEmpty++;
           consecutiveSuccess = 0;
         } else {
           break; // Open PR, ignore
         }

         if (consecutiveEmpty >= 3 || consecutiveSuccess >= 3) break;
      }
    }
  } catch(e) {}

  return { mergedPRs, optimalHour, consecutiveEmpty, consecutiveSuccess };
}

function calculateTier(mergedPRs) {
  if (mergedPRs > 30) return 4; // High
  if (mergedPRs > 10) return 3; // Active
  if (mergedPRs > 2) return 2;  // Standard
  if (mergedPRs > 0) return 1;  // Low-churn
  return 0;                     // Dormant
}

function calculateSchedule() {
  const telemetry = getTelemetry();
  let baseTier = calculateTier(telemetry.mergedPRs);

  // Adjustment triggers
  let adjustmentRationale = '';
  if (telemetry.consecutiveEmpty >= 3) {
    baseTier = Math.max(0, baseTier - 1);
    adjustmentRationale = ' (reduced due to 3+ consecutive empty runs)';
  } else if (telemetry.consecutiveSuccess >= 3) {
    baseTier = Math.min(4, baseTier + 1);
    adjustmentRationale = ' (increased due to 3+ consecutive successful PRs)';
  }

  const h = telemetry.optimalHour;
  let newSchedule = '';
  let rationale = '';

  switch (baseTier) {
    case 4:
      newSchedule = `0 ${h},${(h+6)%24},${(h+12)%24},${(h+18)%24} * * *`;
      rationale = `High velocity tier${adjustmentRationale}. Running 4x daily starting at ${h}:00.`;
      break;
    case 3:
      newSchedule = `0 ${h},${(h+12)%24} * * *`;
      rationale = `Active velocity tier${adjustmentRationale}. Running 2x daily starting at ${h}:00.`;
      break;
    case 2:
      newSchedule = `0 ${h} * * *`;
      rationale = `Standard velocity tier${adjustmentRationale}. Running daily at ${h}:00.`;
      break;
    case 1:
      newSchedule = `0 ${h} * * 1`; // Monday
      rationale = `Low-churn velocity tier${adjustmentRationale}. Running weekly on Monday at ${h}:00.`;
      break;
    case 0:
    default:
      newSchedule = `0 ${h} 1 * *`; // 1st of month
      rationale = `Dormant velocity tier${adjustmentRationale}. Running monthly on the 1st at ${h}:00.`;
      break;
  }

  return { newSchedule, rationale };
}

function updateScheduleFiles(newSchedule, rationale) {
  const now = new Date().toISOString();

  let currentScheduleData = {};
  if (fs.existsSync(scheduleFile)) {
    try {
      currentScheduleData = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing schedule file, creating new one.');
    }
  }

  // Oscillation Guard
  if (currentScheduleData.last_updated) {
    const lastUpdate = new Date(currentScheduleData.last_updated);
    const diffHours = (new Date() - lastUpdate) / (1000 * 60 * 60);
    // Force recompute if unchanged for extended period (e.g., 30 days)
    if (diffHours < 24) {
      console.log('Schedule updated less than 24 hours ago. Skipping recompute to avoid thrashing.');
      return;
    }

    // User manual edit override check - if file was edited by human manually (we can assume if it doesn't match our last generated)
    // Actually, we just respect whatever is in the file. But we recompute anyway if it's been more than 24 hours.
  }

  if (currentScheduleData.schedule === newSchedule) {
    console.log(`Schedule is already ${newSchedule}. No change needed.`);
    return;
  }

  const updatedScheduleData = {
    schedule: newSchedule,
    rationale: rationale,
    last_updated: now,
  };

  fs.writeFileSync(scheduleFile, yaml.dump(updatedScheduleData));
  console.log(`Updated ${scheduleFile} with new schedule: ${newSchedule}`);

  if (fs.existsSync(workflowFile)) {
    let workflowContent = fs.readFileSync(workflowFile, 'utf8');

    const regex = /^\s*- cron:\s*['"]?.*?['"]?\s*# AUTO-UPDATED/m;
    if (regex.test(workflowContent)) {
       workflowContent = workflowContent.replace(
         regex,
         `    - cron: '${newSchedule}' # AUTO-UPDATED`
       );

       try {
           yaml.load(workflowContent);
           fs.writeFileSync(workflowFile, workflowContent);
           console.log(`Updated ${workflowFile} with new schedule: ${newSchedule}`);
       } catch (err) {
           console.error("Generated YAML is invalid, aborting replacement.");
           process.exit(1);
       }
    } else {
       console.warn(`Could not find '# AUTO-UPDATED' marker in ${workflowFile}. Manual update may be required.`);
    }
  }
}

console.log('Computing new schedule...');
const { newSchedule, rationale } = calculateSchedule();
console.log(`Computed: ${newSchedule} (${rationale})`);
updateScheduleFiles(newSchedule, rationale);

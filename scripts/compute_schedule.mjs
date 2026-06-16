#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const scheduleFile = resolve(rootDir, ".github", "self-heal-schedule.yml");

const TIERS = ['dormant', 'low-churn', 'standard', 'active', 'high'];

function getCommitDates() {
  try {
    const output = execSync('git log --format=%aI --since="30 days ago"', {
      encoding: "utf8",
      cwd: rootDir,
    });
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((dateStr) => new Date(dateStr));
  } catch (error) {
    console.error("Failed to get git log. Returning empty array.");
    return [];
  }
}

function getQuietHour(dates) {
  if (dates.length === 0) return 0;
  const hourCounts = new Array(24).fill(0);
  dates.forEach(d => { hourCounts[d.getHours()]++; });
  const minHour = hourCounts.indexOf(Math.min(...hourCounts));
  return minHour;
}

function checkTelemetryAdjustments(currentTierIdx) {
  let newTierIdx = currentTierIdx;
  try {
    const emptyRunsStr = execSync('gh run list --workflow=self-heal.yml --status completed --limit 3 --json conclusion -q ".[].conclusion"', { encoding: 'utf8', cwd: rootDir });
    const emptyRuns = emptyRunsStr.trim().split('\n');
    if (emptyRuns.length >= 3 && emptyRuns.every(c => c === 'success')) {
       const prsStr = execSync('gh pr list --label self-heal --state merged --limit 3 --json state -q ".[].state"', { encoding: 'utf8', cwd: rootDir });
       const prs = prsStr.trim().split('\n').filter(Boolean);
       if (prs.length === 0) {
          newTierIdx = Math.max(0, currentTierIdx - 1);
       } else if (prs.length >= 3 && prs.every(s => s === 'MERGED')) {
          newTierIdx = Math.min(TIERS.length - 1, currentTierIdx + 1);
       }
    }
  } catch(e) {
     console.log('Could not fetch GH telemetry. Skipping adjustments.');
  }
  return newTierIdx;
}

function calculateTier(commitsLast30Days) {
  if (commitsLast30Days > 50) return 4;
  if (commitsLast30Days > 20) return 3;
  if (commitsLast30Days > 5) return 2;
  if (commitsLast30Days > 0) return 1;
  return 0;
}

function getCronForTier(tierIdx, dates) {
  const quietHour = getQuietHour(dates);
  const hourString = quietHour.toString();

  switch(tierIdx) {
    case 4: return `0 ${hourString},${(quietHour+6)%24},${(quietHour+12)%24},${(quietHour+18)%24} * * *`;
    case 3: return `0 ${hourString},${(quietHour+12)%24} * * *`;
    case 2: return `0 ${hourString} * * *`;
    case 1: return `0 ${hourString} * * 0`;
    case 0: return `0 ${hourString} 1 * *`;
    default: return `0 0 * * *`;
  }
}

function updateYaml(newCron, reason) {
  let doc = {
    LAST_UPDATED: new Date().toISOString(),
    SCHEDULE: newCron,
    RATIONALE: reason,
  };
  try {
    const fileContents = readFileSync(scheduleFile, "utf8");
    doc = yaml.load(fileContents);

    // Oscillation guard: only update if it's been more than 3 days
    if (doc.LAST_UPDATED) {
      const lastUpdated = new Date(doc.LAST_UPDATED);
      const now = new Date();
      const diffTime = Math.abs(now - lastUpdated);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 3 && doc.SCHEDULE !== newCron) {
        console.log(
          `Skipping update to prevent oscillation. Last updated ${diffDays} days ago.`,
        );
        return;
      }
    }

    if (doc.SCHEDULE === newCron) {
      console.log("Schedule is unchanged.");
      return;
    }
  } catch (e) {
    console.log("Schedule file not found or invalid, creating new one.");
  }

  doc.SCHEDULE = newCron;
  doc.RATIONALE = reason;
  doc.LAST_UPDATED = new Date().toISOString();

  const newYaml = yaml.dump(doc, { forceQuotes: true });
  writeFileSync(scheduleFile, newYaml, "utf8");
  console.log(`Updated schedule to ${newCron} due to: ${reason}`);
}

function main() {
  const dates = getCommitDates();
  let tierIdx = calculateTier(dates.length);
  tierIdx = checkTelemetryAdjustments(tierIdx);
  const tierName = TIERS[tierIdx];
  const newCron = getCronForTier(tierIdx, dates);
  const reason = `Computed tier '${tierName}' based on telemetry logic and commit volume.`;

  updateYaml(newCron, reason);
}

main();

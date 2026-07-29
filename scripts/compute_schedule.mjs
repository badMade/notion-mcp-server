#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(REPO_ROOT, '.github', 'self-heal-schedule.yml');
const WORKFLOW_FILE = path.join(REPO_ROOT, '.github', 'workflows', 'self-heal.yml');

const TIERS = {
  high: "0 */6 * * *", // Every 6 hours
  active: "0 */12 * * *", // Every 12 hours
  standard: "0 0 * * *", // Daily
  low_churn: "0 0 * * 0", // Weekly
  dormant: "0 0 1 * *", // Monthly
};

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    return "";
  }
}

function computeTier() {
  const ONE_WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // PR velocity
  let prs = 0;
  try {
    const prData = runCmd(`gh pr list --state all --json createdAt -q '[.[] | select(.createdAt >= "${ONE_WEEK_AGO}")]'`);
    if (prData) {
      prs = JSON.parse(prData).length;
    }
  } catch (e) {
    // fallback if gh fails
    const commits = runCmd(`git rev-list --count --since="1 week ago" HEAD`);
    prs = parseInt(commits || "0", 10);
  }

  if (prs > 20) return { tier: 'high', rationale: `High PR velocity (${prs} PRs/commits in last week)` };
  if (prs > 10) return { tier: 'active', rationale: `Active PR velocity (${prs} PRs/commits in last week)` };
  if (prs > 3) return { tier: 'standard', rationale: `Standard PR velocity (${prs} PRs/commits in last week)` };
  if (prs > 0) return { tier: 'low_churn', rationale: `Low churn (${prs} PRs/commits in last week)` };
  return { tier: 'dormant', rationale: 'Dormant repository (0 PRs/commits in last week)' };
}

function computeSelfHealPerformance(currentTier) {
  let consecutiveEmpty = 0;
  let consecutiveSuccess = 0;

  try {
    const runsData = runCmd(`gh run list --workflow="self-heal.yml" --json conclusion,createdAt -q '.[0:5]'`);
    if (runsData) {
      const runs = JSON.parse(runsData);
      for (const run of runs) {
        if (run.conclusion === 'success') {
          // Check if PR was created
          const runDate = new Date(run.createdAt);
          const prsData = runCmd(`gh pr list --label self-heal --json createdAt -q '[.[] | select(.createdAt >= "${runDate.toISOString()}")]'`);
          const prs = prsData ? JSON.parse(prsData) : [];
          if (prs.length > 0) {
            consecutiveSuccess++;
            consecutiveEmpty = 0;
          } else {
            consecutiveEmpty++;
            consecutiveSuccess = 0;
          }
        } else {
          break; // Stop on first non-success or cancelled
        }
      }
    }
  } catch (e) { /* ignore */ }

  const tierKeys = Object.keys(TIERS);
  let tierIndex = tierKeys.indexOf(currentTier);
  if (tierIndex === -1) tierIndex = 2; // Default to standard

  if (consecutiveEmpty >= 3 && tierIndex < tierKeys.length - 1) {
    const newTier = tierKeys[tierIndex + 1];
    return { tier: newTier, rationale: `Reduced frequency due to ${consecutiveEmpty} consecutive empty runs` };
  } else if (consecutiveSuccess >= 3 && tierIndex > 0) {
    const newTier = tierKeys[tierIndex - 1];
    return { tier: newTier, rationale: `Increased frequency due to ${consecutiveSuccess} consecutive successful PRs` };
  }

  return null;
}

async function main() {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.error("Schedule file not found.");
    process.exit(1);
  }

  const content = fs.readFileSync(SCHEDULE_FILE, 'utf8');
  let config;
  try {
    config = yaml.load(content);
  } catch (e) {
    console.error("Failed to parse schedule yaml", e);
    process.exit(1);
  }

  const lastUpdated = new Date(config.LAST_UPDATED || 0);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  // Oscillation guard: only recompute every 3 days unless forced
  if (daysSinceUpdate < 3) {
    console.log("Schedule updated recently. Skipping recomputation.");
    process.exit(0);
  }

  let { tier, rationale } = computeTier();
  const perfAdjustment = computeSelfHealPerformance(tier);
  if (perfAdjustment) {
    tier = perfAdjustment.tier;
    rationale = perfAdjustment.rationale;
  }

  const newSchedule = TIERS[tier];

  if (config.SCHEDULE === newSchedule) {
    console.log("Schedule is already optimal. No changes.");
    process.exit(0);
  }

  console.log(`Updating schedule to ${newSchedule} (${tier}) - ${rationale}`);

  // Update schedule metadata safely via yaml dump but preserve comments where possible by doing regex replace first
  // js-yaml removes comments, so for the self-heal-schedule.yml which is simple, let's try standard replace if it works
  const newContent = content
    .replace(/SCHEDULE:\s*["'].*?["']\s*# AUTO-UPDATED/, `SCHEDULE: "${newSchedule}" # AUTO-UPDATED`)
    .replace(/LAST_UPDATED:\s*["'].*?["']/, `LAST_UPDATED: "${new Date().toISOString()}"`)
    .replace(/RATIONALE:\s*["'].*?["']/, `RATIONALE: "${rationale}"`)
    .replace(/TIER:\s*["'].*?["']/, `TIER: "${tier}"`);

  fs.writeFileSync(SCHEDULE_FILE, newContent, 'utf8');

  // Also try to update the actual GitHub Actions workflow
  if (fs.existsSync(WORKFLOW_FILE)) {
    let wfContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
    wfContent = wfContent.replace(
      /cron:\s*["'].*?["']\s*# AUTO-UPDATED/,
      `cron: "${newSchedule}" # AUTO-UPDATED`
    );
    fs.writeFileSync(WORKFLOW_FILE, wfContent, 'utf8');
  }

  console.log("Schedule updated successfully.");
}

main().catch(e => {
  console.error("Error computing schedule:", e);
  process.exit(1);
});

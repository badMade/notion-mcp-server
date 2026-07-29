#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Computes an optimal cron schedule for self-healing based on telemetry.
 * It uses heuristics: commit frequency, active-period detection, and adjustment triggers.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schedulePath = resolve(__dirname, '../.github/self-heal-schedule.yml');

// Telemetry gathering
const getTelemetry = () => {
  try {
    const gitLog = execSync('git log --since="14 days ago" --format=%aI', { encoding: 'utf-8' });
    const commitDates = gitLog.trim().split('\n').filter(l => l.length > 0).map(d => new Date(d));

    // Count successful and empty selfheal runs via PR labels
    const openPRs = JSON.parse(execSync('gh pr list --label self-heal --state all --json state,createdAt,mergedAt --limit 10', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }) || '[]');

    let consecutiveFailures = 0; // Empty means the pipeline ran but no PR was created, which we can't easily track without actions logs.
    // We'll use merged PRs vs closed unmerged PRs as a proxy for "success vs fail/empty".
    let consecutiveSuccesses = 0;

    // For simplicity, let's just count recent merged vs closed
    for (const pr of openPRs) {
      if (pr.state === 'MERGED') {
        consecutiveSuccesses++;
        consecutiveFailures = 0;
      } else if (pr.state === 'CLOSED') {
        consecutiveFailures++;
        consecutiveSuccesses = 0;
      }
    }

    return { commitDates, consecutiveFailures, consecutiveSuccesses };
  } catch (error) {
    console.warn('[compute_schedule] Could not fetch complete telemetry, using defaults.', error.message);
    return { commitDates: [], consecutiveFailures: 0, consecutiveSuccesses: 0 };
  }
};

const determineActiveWindow = (commitDates) => {
  if (commitDates.length === 0) return 0; // Default to midnight UTC
  const hourCounts = new Array(24).fill(0);
  for (const d of commitDates) {
    hourCounts[d.getUTCHours()]++;
  }

  // Find quietest window (e.g. 4 hour block with fewest commits)
  let minCommits = Infinity;
  let quietestHour = 0;
  for (let i = 0; i < 24; i++) {
    let windowCommits = 0;
    for (let j = 0; j < 4; j++) {
      windowCommits += hourCounts[(i + j) % 24];
    }
    if (windowCommits < minCommits) {
      minCommits = windowCommits;
      quietestHour = i;
    }
  }
  // Schedule immediately before quiet window
  return (quietestHour - 1 + 24) % 24;
};

const determineSchedule = (telemetry) => {
  const commits = telemetry.commitDates.length;
  const hour = determineActiveWindow(telemetry.commitDates);

  let baseTier = 0; // 0: dormant, 1: low-churn, 2: standard, 3: active, 4: high
  if (commits > 50) baseTier = 4;
  else if (commits > 20) baseTier = 3;
  else if (commits > 5) baseTier = 2;
  else if (commits > 0) baseTier = 1;

  // Adjustment triggers
  if (telemetry.consecutiveSuccesses >= 3) baseTier = Math.min(4, baseTier + 1);
  if (telemetry.consecutiveFailures >= 3) baseTier = Math.max(0, baseTier - 1);

  switch(baseTier) {
    case 4: return { cron: `0 */4 * * *`, reason: "high churn" }; // Multiple per day
    case 3: return { cron: `0 */8 * * *`, reason: "active" };     // Multiple per day
    case 2: return { cron: `0 ${hour} * * *`, reason: "standard" };     // Once a day at quietest
    case 1: return { cron: `0 ${hour} * * 1,4`, reason: "low-churn" };  // Twice a week
    default: return { cron: `0 ${hour} * * 0`, reason: "dormant" };                        // Once a week
  }
};

const main = () => {
  console.log('[compute_schedule] Fetching telemetry...');
  const telemetry = getTelemetry();
  console.log(`[compute_schedule] Commits in last 14 days: ${telemetry.commitDates.length}`);

  const { cron, reason } = determineSchedule(telemetry);
  console.log(`[compute_schedule] Determined schedule: "${cron}" (${reason})`);

  let currentData;
  try {
    const fileContent = readFileSync(schedulePath, 'utf-8');
    currentData = yaml.load(fileContent);
  } catch (err) {
    console.log('[compute_schedule] Could not read existing schedule, creating new.');
    currentData = {};
  }

  // Oscillation guard: only update if last update was > 3 days ago OR if there's a significant manual trigger.
  // Assuming this runs weekly, so it shouldn't oscillate too much.
  const now = new Date();
  if (currentData.last_computed) {
      const lastComputed = new Date(currentData.last_computed);
      const daysSince = (now - lastComputed) / (1000 * 60 * 60 * 24);
      if (daysSince < 3 && currentData.schedule !== cron) {
          console.log('[compute_schedule] Schedule changed but oscillation guard triggered (updated < 3 days ago). Keeping current.');
          process.exit(0);
      }
  }

  if (currentData.schedule === cron) {
    console.log('[compute_schedule] Schedule is already optimal. No changes needed.');
    process.exit(0);
  }

  currentData.schedule = cron;
  currentData.reason = reason;
  currentData.last_computed = now.toISOString();

  // js-yaml doesn't quote string values automatically if not strictly needed.
  // We can force quotes via dumping options.
  const yamlStr = yaml.dump(currentData, { forceQuotes: true });
  const finalOutput = `# AUTO-UPDATED\n${yamlStr}`;

  try {
    yaml.load(yamlStr);
    writeFileSync(schedulePath, finalOutput, 'utf-8');
    console.log(`[compute_schedule] Wrote new schedule to ${schedulePath}`);
    process.exit(0);
  } catch (e) {
    console.error('[compute_schedule] Failed to generate valid YAML.', e);
    process.exit(1);
  }
};

main();

#!/usr/bin/env node

/**
 * compute_schedule.mjs - Dynamically computes CI cadence based on PR velocity.
 * Outputs safe YAML updates to .github/self-heal-schedule.yml.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const SCHEDULE_FILE = join(process.cwd(), '.github', 'self-heal-schedule.yml');

// Helper to run shell commands silently
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (e) {
    return '';
  }
}

// 1. Oscillation Guard
let currentConfig = { schedule: '0 0 * * *', rationale: 'Default', last_updated: 0 };
try {
  const content = readFileSync(SCHEDULE_FILE, 'utf-8');
  currentConfig = yaml.load(content) || currentConfig;
} catch (e) {
  console.log("No existing schedule file found, creating new one.");
}

const now = Date.now();
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
if (currentConfig.last_updated && (now - currentConfig.last_updated) < THREE_DAYS_MS) {
  console.log("Schedule updated recently. Skipping computation to prevent oscillation.");
  process.exit(0); // Exit successfully, no work to do
}

// 2. Telemetry: Count merged PRs in the last 7 days
// Uses GitHub CLI. We assume `gh` is authenticated.
let mergedPrCount = 0;
try {
  // Use a fallback or dummy value if we aren't actually running in full CI yet.
  const prs = runCmd('gh pr list --state merged --json mergedAt --search "merged:>$(date -d \'7 days ago\' +%Y-%m-%d)" -q "length"');
  mergedPrCount = parseInt(prs, 10);
  if (isNaN(mergedPrCount)) mergedPrCount = 0;
} catch (e) {
  console.warn("Could not fetch PR telemetry, defaulting to 0.");
  mergedPrCount = 0;
}

// 3. Cadence Tiers
let newCron = '';
let rationale = '';

if (mergedPrCount > 20) {
  newCron = '0 */4 * * *'; // Every 4 hours
  rationale = 'High PR velocity (>20 merges/week). Increased frequency.';
} else if (mergedPrCount > 5) {
  newCron = '0 */12 * * *'; // Twice a day
  rationale = 'Active PR velocity (>5 merges/week). Standard frequency.';
} else if (mergedPrCount > 0) {
  newCron = '0 0 * * *'; // Daily
  rationale = 'Standard PR velocity (>0 merges/week). Daily frequency.';
} else {
  newCron = '0 0 * * 1'; // Weekly
  rationale = 'Low PR velocity (0 merges/week). Weekly frequency.';
}

// 4. Update the schedule metadata file safely using js-yaml
const updatedConfig = {
  schedule: newCron,
  rationale: rationale,
  last_updated: now,
};

writeFileSync(SCHEDULE_FILE, yaml.dump(updatedConfig));

console.log(`Computed new schedule: ${newCron}`);
console.log(`Rationale: ${rationale}`);

// Note: The actual `.github/workflows/self-heal.yml` string replacement via sed
// will happen in the workflow file using the # AUTO-UPDATED marker.
process.exit(0);

#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const scheduleFile = join(rootDir, '.github/self-heal-schedule.yml');

// Schedule tiers based on velocity
const TIERS = {
  high: '0 */4 * * *',      // Every 4 hours
  active: '0 */8 * * *',    // Every 8 hours
  standard: '0 0 * * *',    // Daily at midnight
  'low-churn': '0 0 * * 1', // Weekly on Monday
  dormant: '0 0 1 * *'      // Monthly
};

function getPRVelocity() {
  try {
    const output = execSync('gh pr list --state merged --json mergedAt --limit 100', { stdio: 'pipe' }).toString();
    const prs = JSON.parse(output);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPRs = prs.filter(pr => new Date(pr.mergedAt) > thirtyDaysAgo);

    if (recentPRs.length > 20) return 'high';
    if (recentPRs.length > 5) return 'active';
    if (recentPRs.length > 1) return 'standard';
    return 'low-churn';
  } catch (e) {
    // Fallback if gh CLI is not available or fails
    return 'standard';
  }
}

function computeSchedule() {
  const velocity = getPRVelocity();
  const schedule = TIERS[velocity] || TIERS.standard;
  const now = new Date().toISOString();

  let currentMetadata = {
    schedule: TIERS.standard,
    last_updated: new Date(0).toISOString(),
    rationale: 'Initial bootstrap schedule'
  };

  if (existsSync(scheduleFile)) {
    try {
      const content = readFileSync(scheduleFile, 'utf8');
      currentMetadata = yaml.load(content) || currentMetadata;
    } catch (e) {
      console.warn("Could not read existing schedule file, using defaults.");
    }
  }

  if (currentMetadata.schedule === schedule) {
    console.log("Schedule is unchanged. Skipping update.");
    return;
  }

  const newMetadata = {
    schedule,
    last_updated: now,
    rationale: `Computed from PR velocity in last 30 days: ${velocity}`
  };

  const yamlStr = yaml.dump(newMetadata);
  writeFileSync(scheduleFile, yamlStr, 'utf8');
  console.log(`Updated schedule to: ${schedule}`);

  // Update workflow file dynamically using exact replacement anchoring
  const workflowFile = join(rootDir, '.github/workflows/self-heal.yml');
  if (existsSync(workflowFile)) {
    let workflowContent = readFileSync(workflowFile, 'utf8');
    workflowContent = workflowContent.replace(
      /cron:\s*['"].*['"]\s*# AUTO-UPDATED/,
      `cron: '${schedule}' # AUTO-UPDATED`
    );
    // Validate YAML
    try {
      yaml.load(workflowContent);
      writeFileSync(workflowFile, workflowContent, 'utf8');
      console.log("Updated workflow schedule successfully.");
    } catch (e) {
      console.error("Failed to parse updated workflow YAML. Aborting workflow write.");
    }
  }
}

computeSchedule();

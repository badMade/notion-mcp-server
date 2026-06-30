#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const scheduleConfigPath = resolve(process.cwd(), '.github/self-heal-schedule.yml');
const workflowConfigPath = resolve(process.cwd(), '.github/workflows/self-heal.yml');

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function getPRVelocity() {
  const output = runCommand('gh pr list --state merged --json mergedAt -q "length"');
  return output ? parseInt(output, 10) : 0;
}

function computeTier(velocity) {
  if (velocity > 10) return { cron: '0 * * * *', tier: 'high (hourly)', rationale: 'High PR velocity detected.' };
  if (velocity > 5) return { cron: '0 */4 * * *', tier: 'active (every 4 hours)', rationale: 'Active PR velocity detected.' };
  if (velocity > 1) return { cron: '0 0 * * *', tier: 'standard (daily)', rationale: 'Standard PR velocity detected.' };
  return { cron: '0 0 * * 1', tier: 'low (weekly)', rationale: 'Low or dormant PR velocity detected.' };
}

console.log('Gathering telemetry...');
const prVelocity = getPRVelocity();
const { cron, tier, rationale } = computeTier(prVelocity);
const now = new Date().toISOString();

console.log(`Computed new schedule: ${cron} (${tier})`);

// 1. Update the metadata file
let scheduleMeta = { schedule: '', rationale: '', last_updated: '' };
try {
  const content = readFileSync(scheduleConfigPath, 'utf-8');
  scheduleMeta = yaml.load(content) || scheduleMeta;
} catch {}

if (scheduleMeta.schedule === cron) {
  console.log('Schedule is already optimal. No changes needed.');
  process.exit(0);
}

scheduleMeta.schedule = cron;
scheduleMeta.rationale = rationale;
scheduleMeta.last_updated = now;
writeFileSync(scheduleConfigPath, yaml.dump(scheduleMeta));
console.log('Updated .github/self-heal-schedule.yml');

// 2. Update the actual GitHub Actions workflow
try {
  let workflowContent = readFileSync(workflowConfigPath, 'utf-8');
  // Strict regex replacement anchored by the `# AUTO-UPDATED` marker
  workflowContent = workflowContent.replace(/cron:\s*['"].*?['"]\s*#\s*AUTO-UPDATED/g, `cron: '${cron}' # AUTO-UPDATED`);
  writeFileSync(workflowConfigPath, workflowContent);

  // Validation check
  yaml.load(workflowContent);
  console.log('Updated and validated .github/workflows/self-heal.yml');
} catch (error) {
  console.log('Workflow file not found or validation failed, skipping workflow inline update.');
}

process.exit(0);

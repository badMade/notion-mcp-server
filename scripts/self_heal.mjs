#!/usr/bin/env node

/**
 * Self-healing pipeline.
 * Runs through a series of idempotent repair steps.
 * After each step, runs healthcheck.
 * If healthcheck passes AND there is a diff, exits with 0 (success).
 * If healthcheck passes AND there is no diff, continues to next step.
 * If healthcheck fails, continues to next step.
 * If all steps fail or no diff is generated, exits with 1.
 */

import { execSync } from 'node:child_process';

const REPAIR_STEPS = [
  {
    name: 'Rebuild/reinstall (clean install)',
    command: 'npm ci || npm install',
  },
  {
    name: 'Lint/format auto-fix',
    command: 'npx eslint --fix . || true', // we accept some linting failures still
  },
  {
    name: 'Snapshot/generated updates',
    command: 'npx vitest run -u --passWithNoTests || true',
  },
  {
    name: 'Type stubs/analyzer config',
    command: 'npm run build || true',
  },
  {
    name: 'Dependency re-resolve',
    command: 'npm update',
  },
  {
    name: 'Static asset regeneration',
    command: 'npm run build || true',
  }
];

function runCommand(command, name) {
  console.log(`\n=== Executing Repair Step: ${name} ===`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`⚠️ Step failed: ${name}`);
    return false;
  }
}

function checkHealth() {
  console.log(`\n--- Running Healthcheck ---`);
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkDiff() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim() !== '';
  } catch {
    return false;
  }
}

function main() {
  console.log('Starting Self-Heal Pipeline...');

  if (checkHealth() && checkDiff()) {
    console.log('Project is already healthy and has a diff. Exiting successfully.');
    process.exit(0);
  }

  for (const step of REPAIR_STEPS) {
    runCommand(step.command, step.name);

    const isHealthy = checkHealth();
    const hasDiff = checkDiff();

    if (isHealthy) {
      if (hasDiff) {
        console.log(`\n✅ Step '${step.name}' successfully repaired the project (healthcheck passed + diff found).`);
        process.exit(0);
      } else {
        console.log(`\nℹ️ Step '${step.name}' resulted in a healthy state but no diff. Continuing...`);
      }
    } else {
      console.log(`\n❌ Step '${step.name}' did not result in a healthy state. Continuing...`);
    }
  }

  console.log('\n❌ All repair steps exhausted. Could not automatically heal the project.');
  process.exit(1);
}

main();

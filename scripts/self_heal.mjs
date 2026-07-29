#!/usr/bin/env node

/**
 * Self-heal script for the self-healing CI pipeline.
 * Runs an idempotent 6-step repair pipeline.
 * Exits with 0 ONLY if healthcheck passes AND there is a diff.
 * Exits with 1 otherwise.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Helper to run healthcheck
function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to check for a non-empty diff
function hasDiff() {
  const diff = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' });
  return diff.trim().length > 0;
}

// Run the healthcheck initially
console.log('Running initial healthcheck...');
const initialHealthy = runHealthcheck();
if (initialHealthy && !hasDiff()) {
    console.log('Initially healthy and no diff. Exiting 1 to skip PR creation.');
    process.exit(1);
}

const steps = [
  {
    name: 'Step 1: Rebuild/reinstall',
    command: 'npm ci'
  },
  {
    name: 'Step 2: Lint/format auto-fix',
    command: 'npx eslint --fix . && npx prettier -w .'
  },
  {
    name: 'Step 3: Snapshot/generated updates',
    command: 'npx vitest run -u --passWithNoTests'
  },
  {
    name: 'Step 4: Type stubs/analyzer config',
    command: 'npx typesync || true'
  },
  {
    name: 'Step 5: Dependency re-resolve',
    command: 'npm update || true'
  },
  {
    name: 'Step 6: Static asset regeneration',
    command: 'npm run build || true'
  }
];

for (const step of steps) {
  console.log(`\n================================`);
  console.log(`Running ${step.name}...`);
  try {
    execSync(step.command, { stdio: 'inherit', cwd: rootDir });
  } catch (error) {
    console.error(`Error during ${step.name}:`, error.message);
    // Continue to next step even if this one failed
  }

  // After each step, run healthcheck to see if we've fixed it
  console.log(`Verifying after ${step.name}...`);
  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log('Healthcheck passed and diff exists! Repair successful.');
      process.exit(0);
    } else {
       console.log('Healthcheck passed but NO diff exists. Something might have been partially repaired with no changes.');
    }
  } else {
      console.log('Healthcheck failed, continuing to next step...');
  }
}

console.error('\nAll repair steps exhausted, but healthcheck still failing or no diff produced.');
process.exit(1);

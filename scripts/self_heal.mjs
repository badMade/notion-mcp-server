#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * Implements idempotent repair steps.
 * Exits 0 ONLY if all tests pass AND there is a diff.
 * Exits 1 otherwise.
 */

import { execSync } from 'child_process';

// Ensure we are in project root (assuming this is in scripts/)
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

function runSilent(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status.length > 0;
}

function runHealthcheck() {
  return runSilent('node scripts/healthcheck.mjs');
}

// Ensure clean slate check first
const initialHealth = runHealthcheck();
const initialDiff = hasDiff();

console.log('Starting self-healing process...');

const repairSteps = [
  {
    name: 'Step 1: Rebuild/reinstall (clean install of tooling + deps)',
    command: 'npm ci'
  },
  {
    name: 'Step 2: Lint/format auto-fix (prettier format)',
    command: 'npx prettier -w src scripts'
  },
  {
    name: 'Step 3: Snapshot/generated updates (vitest updateSnapshot)',
    command: 'npx vitest run -u'
  },
  {
    name: 'Step 4: Type stubs/analyzer config (tsc)',
    command: 'npm run build' // This will invoke tsc -build and esbuild
  },
  {
    name: 'Step 5: Dependency re-resolve (lockfile refresh)',
    command: 'npm install --package-lock-only'
  },
  {
    name: 'Step 6: Static asset regeneration',
    command: 'echo "No static assets to regenerate"' // Placeholder for future use
  }
];

for (const step of repairSteps) {
  console.log(`Running ${step.name}...`);
  runSilent(step.command);

  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log(`Self-healing succeeded after ${step.name}. Changes detected.`);
      process.exit(0);
    } else {
      console.log(`Healthcheck passed after ${step.name}, but no diff found. Continuing...`);
    }
  } else {
      console.log(`Healthcheck failed after ${step.name}. Continuing to next step...`);
  }
}

console.log('Self-healing process finished.');
if (runHealthcheck() && hasDiff()) {
    console.log('Final healthcheck passed and diff exists.');
    process.exit(0);
}

console.log('Self-healing failed to find a fix or no changes were necessary.');
process.exit(1);

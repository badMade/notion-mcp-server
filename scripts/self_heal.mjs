#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

const healthcheckCmd = 'node scripts/healthcheck.mjs';

function runHealthcheck() {
  try {
    execSync(healthcheckCmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function verifyAndExit(stepName) {
  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log(`✅ Repaired successfully after: ${stepName}. Exiting 0.`);
      process.exit(0);
    } else {
      console.log(`ℹ️ Healthcheck passed, but no diff found after: ${stepName}. Continuing...`);
    }
  }
}

const steps = [
  {
    name: 'Step 1: Rebuild/reinstall',
    run: () => {
      console.log('Running Step 1: Clean install dependencies');
      execSync('npm ci', { stdio: 'inherit' });
    },
  },
  {
    name: 'Step 2: Lint/format auto-fix',
    run: () => {
      console.log('Running Step 2: Lint/format auto-fix');
      try {
        execSync('npx eslint --fix .', { stdio: 'inherit' });
      } catch (e) {
        // ignore errors from eslint fix
      }
      try {
        execSync('npx prettier -w .', { stdio: 'inherit' });
      } catch (e) {
        // ignore errors from prettier
      }
    },
  },
  {
    name: 'Step 3: Snapshot/generated updates',
    run: () => {
      console.log('Running Step 3: Snapshot regeneration');
      try {
        execSync('npx vitest run -u', { stdio: 'inherit' });
      } catch (e) {}
    },
  },
  {
    name: 'Step 4: Type stubs/analyzer config',
    run: () => {
      console.log('Running Step 4: Type stubs');
      // e.g. typesync if available
      try {
         execSync('npx typesync', { stdio: 'inherit' });
         execSync('npm install', { stdio: 'inherit' });
      } catch (e) {}
    },
  },
  {
    name: 'Step 5: Dependency re-resolve',
    run: () => {
      console.log('Running Step 5: Dependency re-resolve');
      // In JS, this might be npm update
      try {
         execSync('npm update', { stdio: 'inherit' });
      } catch (e) {}
    },
  },
  {
    name: 'Step 6: Static asset regeneration',
    run: () => {
      console.log('Running Step 6: Static asset regeneration');
      // project specific. We will try a build just in case.
      try {
          execSync('npm run build', { stdio: 'inherit' });
      } catch (e) {}
    },
  }
];

console.log('Starting Self-Heal Pipeline...');

// Initial check: if everything is fine, we don't necessarily want to run repairs?
// Actually we only run this script if we *know* something is wrong or if we want to force check.
// Let's just run through the steps.
for (const step of steps) {
  console.log(`\n============================`);
  console.log(`${step.name}`);
  console.log(`============================`);
  step.run();
  verifyAndExit(step.name);
}

console.error('❌ Could not heal the system. Exiting 1.');
process.exit(1);

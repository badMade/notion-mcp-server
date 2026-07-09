#!/usr/bin/env node

import cp from 'child_process';
import path from 'path';

function run(command) {
  try {
    cp.execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkHealth() {
  try {
    cp.execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const status = cp.execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function checkAndExitIfFixed() {
  if (checkHealth()) {
    if (hasDiff()) {
      console.log('Healthcheck passed and diff found. Exiting with success (0).');
      process.exit(0);
    } else {
      console.log('Healthcheck passed but no diff found. Continuing...');
    }
  } else {
    console.log('Healthcheck failed. Continuing...');
  }
}

console.log('Starting self-healing process...');

const steps = [
  { name: 'Step 1: Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Step 2: Lint/format auto-fix', cmd: 'npx eslint --fix . || true' },
  { name: 'Step 3: Snapshot/generated updates', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: 'Step 4: Type stubs/analyzer config', cmd: 'echo "No type stub updates configured"' },
  { name: 'Step 5: Dependency re-resolve', cmd: 'npm update' },
  { name: 'Step 6: Static asset regeneration', cmd: 'echo "No static assets to regenerate"' }
];

for (const step of steps) {
  console.log(`\n--- Running ${step.name} ---`);
  run(step.cmd);
  checkAndExitIfFixed();
}

console.log('Exhausted all repair steps. If healthcheck fails, pipeline should fail.');
process.exit(checkHealth() && hasDiff() ? 0 : 1);

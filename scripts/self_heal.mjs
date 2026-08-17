#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function checkDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function evaluate() {
  const isHealthy = checkHealth();
  const hasDiff = checkDiff();
  if (isHealthy && hasDiff) {
    console.log('Repair successful and diff created. Exiting with 0.');
    process.exit(0);
  }
  // We return false if evaluate shouldn't break out of the loop
  return false;
}

const steps = [
  { name: 'Step 1: Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Step 2: Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Step 3: Snapshot/generated updates', cmd: 'npx vitest run -u' },
  { name: 'Step 4: Type stubs/analyzer config', cmd: 'npx --yes typesync' },
  { name: 'Step 5: Dependency re-resolve', cmd: 'npm update' },
  { name: 'Step 6: Static asset regeneration', cmd: 'npm run build' }
];

console.log('Starting self-heal pipeline...');

for (const step of steps) {
  console.log(`\nExecuting ${step.name}`);
  run(step.cmd);
  evaluate(); // This will process.exit(0) if pass+diff, else just continues
}

if (!checkHealth() || !checkDiff()) {
    console.log('Pipeline exhausted without full repair + diff.');
    process.exit(1);
}

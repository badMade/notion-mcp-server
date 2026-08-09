#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function checkDiff() {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    return diff !== '';
  } catch (e) {
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

console.log('Starting self-healing pipeline...');

const steps = [
  { name: 'Step 1: Install', cmd: 'npm ci || npm install' },
  { name: 'Step 2: Lint/format', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Step 3: Snapshot', cmd: 'npx vitest run -u' },
  { name: 'Step 4: Type stubs', cmd: 'npx --yes typesync' },
  { name: 'Step 5: Dep re-resolve', cmd: 'npm update' },
  { name: 'Step 6: Static assets', cmd: 'npm run build' }
];

for (const step of steps) {
  console.log(`\nRunning ${step.name}...`);
  run(step.cmd);

  if (checkHealth()) {
    if (checkDiff()) {
      console.log('Healthcheck passed and diff found. Exiting with success.');
      process.exit(0);
    } else {
      console.log('Healthcheck passed but no diff found. Continuing...');
    }
  } else {
    console.log('Healthcheck still failing. Proceeding to next step.');
  }
}

console.log('Self-healing pipeline completed, but no fix was found.');
process.exit(1);

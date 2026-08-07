#!/usr/bin/env node
import { execSync } from 'child_process';

function run(command) {
  console.log(`\n=== Running: ${command} ===`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error running ${command}`);
    return false;
  }
}

function getDiff() {
  try {
    return execSync('git status --porcelain').toString().trim();
  } catch (e) {
    return '';
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
const initialHealth = checkHealth();
const initialDiff = getDiff();

if (initialHealth && !initialDiff) {
  console.log('System already healthy and no diff. Exiting 1.');
  process.exit(1);
}

const steps = [
  'npm ci',
  'npx eslint --fix src',
  'npx vitest run -u',
  'npx --yes typesync',
  'npm install',
  'npm run build'
];

for (let i = 0; i < steps.length; i++) {
  run(steps[i]);
  const isHealthy = checkHealth();
  const hasDiff = getDiff() !== '';
  if (isHealthy) {
    if (hasDiff) {
       console.log(`Repairs successful after step ${i+1}. Diff generated.`);
       process.exit(0);
    } else {
       console.log(`System healthy but no diff. Continuing...`);
    }
  }
}

console.log('Exhausted repair steps without achieving both health and a diff. Exiting 1.');
process.exit(1);

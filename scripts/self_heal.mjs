#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

if (!fs.existsSync('package.json')) {
  console.error('No package.json found. Run from project root.');
  process.exit(1);
}

function runHealthcheck() {
  try {
    execSync('./scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function hasDiff() {
  const diff = execSync('git status --porcelain').toString().trim();
  return diff.length > 0;
}

const steps = [
  { name: 'install', cmd: 'npm ci || npm install' },
  { name: 'lint', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'snapshot', cmd: 'npx vitest run -u' },
  { name: 'typesync', cmd: 'npx --yes typesync' },
  { name: 'dependencies', cmd: 'npm update' },
  { name: 'assets', cmd: '' }
];

for (const step of steps) {
  console.log(`Running repair step: ${step.name}`);
  try {
    if (step.cmd) execSync(step.cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Step ${step.name} error:`, err.message);
  }

  if (runHealthcheck() && hasDiff()) {
    console.log(`Repair successful after ${step.name}. Changes detected.`);
    process.exit(0);
  }
}

console.log('Self-heal could not resolve the issue or no fix found.');
process.exit(1);

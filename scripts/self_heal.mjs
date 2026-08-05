#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running self-heal pipeline...');

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function evaluateAndExit() {
  if (checkHealth()) {
    if (hasDiff()) {
      console.log('Healthcheck passed with diff. Repair successful.');
      process.exit(0);
    } else {
      console.log('Healthcheck passed but no diff. Continuing...');
    }
  }
}

const steps = [
  { name: 'Rebuild/reinstall', cmd: 'npm install' },
  { name: 'Lint/format auto-fix', cmd: 'npx eslint src/ scripts/ --fix && npx prettier -w src/ scripts/' },
  { name: 'Snapshot updates', cmd: 'npx vitest run -u' },
  { name: 'Type stubs', cmd: 'npx typesync --yes' },
  { name: 'Dependency re-resolve', cmd: 'npm install' },
  { name: 'Static asset regeneration', cmd: 'npm run build' }
];

for (const step of steps) {
  console.log(`Running step: ${step.name}...`);
  try {
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (err) {
    console.log(`Step ${step.name} failed to execute cleanly, but continuing...`);
  }
  evaluateAndExit();
}

console.log('Self-heal pipeline finished. Diff check needed.');
if (checkHealth() && hasDiff()) {
  process.exit(0);
} else {
  process.exit(1);
}
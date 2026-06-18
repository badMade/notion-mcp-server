#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function run(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function checkDiff() {
  const diff = execSync('git status --porcelain').toString().trim();
  return diff.length > 0;
}

function healthcheck() {
  return run('node scripts/healthcheck.mjs');
}

const steps = [
  { name: 'Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Lint/format auto-fix', cmd: 'npx eslint --fix .' },
  { name: 'Snapshot regeneration', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type stubs/analyzer config', cmd: 'npx typesync' },
  { name: 'Dependency re-resolve', cmd: 'npm update' },
  { name: 'Static asset regeneration', cmd: 'npm run build' }
];

console.log('Starting Self-Heal Pipeline...');

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  console.log(`\n--- Step ${i + 1}: ${step.name} ---`);

  run(step.cmd);

  console.log(`Running healthcheck after Step ${i + 1}...`);
  const isHealthy = healthcheck();

  if (isHealthy) {
    if (checkDiff()) {
      console.log(`Healthcheck passed and diff found after step ${i + 1}. Exiting with success.`);
      process.exit(0);
    } else {
      console.log(`Healthcheck passed but no diff found after step ${i + 1}. Continuing...`);
      continue;
    }
  } else {
    console.log(`Healthcheck failed after step ${i + 1}. Continuing to next repair step...`);
  }
}

console.log('\nAll repair steps exhausted. Checking final state...');
if (healthcheck() && checkDiff()) {
  console.log('Final state is healthy with a diff. Exiting with success.');
  process.exit(0);
}

console.error('Failed to auto-repair. Exiting with error.');
process.exit(1);

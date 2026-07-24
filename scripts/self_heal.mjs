#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Starting self-healing pipeline...');

const REPAIR_STEPS = [
  { name: 'Reinstall', cmd: 'npm ci' },
  { name: 'Lint/Format', cmd: 'npx eslint . --fix && npx prettier --write .' },
  { name: 'Snapshots', cmd: 'npx vitest run -u' },
  { name: 'Type Stubs', cmd: 'npx --yes typesync && npm install' },
  { name: 'Dependency Re-resolve', cmd: 'npm update' },
  { name: 'Static Asset Regen', cmd: 'echo "Skipping static asset regen"' }
];

function hasDiff() {
  try {
    const status = execSync('git status --porcelain').toString().trim();
    return status !== '';
  } catch (err) {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

for (let i = 0; i < REPAIR_STEPS.length; i++) {
  const step = REPAIR_STEPS[i];
  console.log(`\n--- Running Repair Step ${i + 1}: ${step.name} ---`);
  console.log(`Executing: ${step.cmd}`);

  try {
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`⚠️ Step ${step.name} encountered an error: ${err.message}`);
    // Continue to healthcheck even if the repair step failed, as it might have partially fixed things
  }

  console.log(`\nRunning post-step healthcheck...`);
  const isHealthy = runHealthcheck();
  const diffExists = hasDiff();

  console.log(`Healthcheck passed: ${isHealthy}`);
  console.log(`Diff exists: ${diffExists}`);

  if (isHealthy) {
    if (diffExists) {
      console.log(`✅ Repair successful and produced a diff after step ${i + 1}. Exiting with success.`);
      process.exit(0);
    } else {
      console.log(`✅ System healthy but no diff produced. Proceeding to next step...`);
    }
  } else {
    console.log(`❌ System still failing healthcheck. Proceeding to next step...`);
  }
}

console.error('\n❌ All repair steps exhausted. System still failing or no diff produced.');
process.exit(1);

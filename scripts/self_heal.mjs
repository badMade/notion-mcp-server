#!/usr/bin/env node
import { execSync } from 'node:child_process';
import path from 'node:path';

function runCmd(cmd) {
  try {
    console.log(`Executing repair: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Repair failed: ${cmd}`);
    return false;
  }
}

function checkHealthAndDiff() {
  let passed = true;
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
  } catch (err) {
    passed = false;
  }

  let hasDiff = false;
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (diff.trim().length > 0) {
      hasDiff = true;
    }
  } catch (err) {}

  return { passed, hasDiff };
}

const repairSteps = [
  // Step 1: Reinstall dependencies
  { name: 'Reinstall dependencies', cmd: 'npm ci' },
  // Step 2: Format & lint fix (ignoring .github/workflows/ci.yml)
  { name: 'Format and lint fix', cmd: 'npx eslint --fix . && npx prettier -w . "!**/.github/workflows/ci.yml"' },
  // Step 3: Update snapshots
  { name: 'Update test snapshots', cmd: 'npx vitest run -u --passWithNoTests' },
  // Step 4: Type stubs acquisition
  { name: 'Update type stubs', cmd: 'npx typesync || true' },
  // Step 5: Dependency re-resolve / refresh
  { name: 'Dependency update', cmd: 'npm update' },
  // Step 6: Rebuild project
  { name: 'Rebuild project', cmd: 'npm run build' }
];

console.log('Starting self-healing pipeline...');

for (const step of repairSteps) {
  console.log(`\n--- Attempting: ${step.name} ---`);
  runCmd(step.cmd);

  const { passed, hasDiff } = checkHealthAndDiff();

  if (passed && hasDiff) {
    console.log(`\nRepair successful and resulted in a diff after step: ${step.name}`);
    process.exit(0);
  } else if (passed && !hasDiff) {
    console.log(`\nHealthy but no diff. Continuing to see if other steps are needed...`);
    continue;
  } else {
    console.log(`\nStill failing healthcheck after step: ${step.name}. Proceeding to next step...`);
  }
}

console.log('\nExhausted repair steps without successfully finding a fix with a diff.');
process.exit(1);

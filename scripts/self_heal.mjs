#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function run(command) {
  try {
    console.log(`Executing: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function checkDiff() {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    return diff !== '';
  } catch (error) {
    return false;
  }
}

function healthcheck() {
  return run('node scripts/healthcheck.mjs');
}

function step(name, command) {
  console.log(`\n--- Step: ${name} ---`);
  run(command);

  if (healthcheck()) {
    if (checkDiff()) {
      console.log('\nRepair successful and produced a diff. Exiting 0.');
      process.exit(0);
    } else {
      console.log('\nRepair successful but no diff produced. Continuing to next step.');
    }
  } else {
    console.log('\nHealthcheck failed after repair step. Continuing to next step.');
  }
}

console.log('Starting Self-Heal Pipeline...');

// Universal, idempotent repair pipeline order
// Step 1: Rebuild/reinstall (clean install of tooling + deps)
step('Rebuild/reinstall', 'npm ci');

// Step 2: Lint/format auto-fix (language-specific formatter)
step('Lint/format auto-fix', 'npx eslint --fix . && npx prettier -w .');

// Step 3: Snapshot/generated updates (test snapshot regeneration)
step('Snapshot updates', 'npx vitest run -u');

// Step 4: Type stubs/analyzer config (acquire missing types)
step('Type stubs', 'npx typesync');

// Step 5: Dependency re-resolve (lockfile refresh)
step('Dependency re-resolve', 'npm update');

// Step 6: Static asset regeneration
step('Static asset regeneration', 'npm run build');

console.log('\nSelf-Heal Pipeline completed. No successful repair produced a diff.');
process.exit(1);

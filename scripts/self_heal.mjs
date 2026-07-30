#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running self-heal pipeline...');

function runAndCheck(command, name) {
  console.log(`\n--- Running ${name} ---`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (e) {
    console.log(`${name} encountered an error or failed.`);
  }

  try {
    console.log(`Checking health after ${name}...`);
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });

    const diff = execSync('git status --porcelain').toString().trim();
    if (diff) {
      console.log(`\nSelf-heal successful after ${name}! Diff created:`);
      console.log(diff);
      process.exit(0);
    } else {
      console.log(`\nHealthcheck passed, but no diff was created by ${name}.`);
    }
  } catch (e) {
    console.log(`Healthcheck failed after ${name}.`);
  }
}

// Step 1: Rebuild/reinstall
runAndCheck('npm install', 'Reinstall dependencies');

// Step 2: Lint/format auto-fix
runAndCheck('npx eslint --fix . && npx prettier -w .', 'Lint and Format');

// Step 3: Snapshot/generated updates
runAndCheck('npx vitest run -u', 'Update snapshots');

// Step 4: Type stubs/analyzer config
runAndCheck('npx --yes typesync', 'Sync types');

// Step 5: Dependency re-resolve
runAndCheck('npm update', 'Update dependencies');

// Step 6: Static asset regeneration
runAndCheck('npm run build', 'Build assets');

console.error('\nSelf-heal pipeline exhausted without generating a valid, healthy diff.');
process.exit(1);

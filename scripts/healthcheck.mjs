#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running healthcheck...');

function runCommand(command, name) {
  console.log(`\n--- Running ${name} ---`);
  try {
    // using inherit to allow outputting to the parent stream (helpful for CI logs)
    execSync(command, { stdio: 'inherit' });
    console.log(`[PASS] ${name}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    return false;
  }
}

let allPassed = true;

// Build check
if (!runCommand('npm run build', 'Build (tsc)')) allPassed = false;

// Lint check (using eslint per instructions)
if (!runCommand('npx eslint .', 'Lint (eslint)')) allPassed = false;

// Test check (using vitest with --passWithNoTests)
if (!runCommand('npx vitest run --passWithNoTests', 'Tests (vitest)')) allPassed = false;

if (allPassed) {
  console.log('\n✅ All healthchecks passed.');
  process.exit(0);
} else {
  console.error('\n❌ Healthcheck failed.');
  process.exit(1);
}

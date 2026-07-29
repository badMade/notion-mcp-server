#!/usr/bin/env node

/**
 * Healthcheck Script
 * Verifies linting, types, tests, and build. Exits 0 if everything passes, 1 otherwise.
 */

import { execSync } from 'child_process';

const runCommand = (command, ignoreError = false) => {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    if (!ignoreError) {
      process.exit(1);
    }
    return false;
  }
};

const main = () => {
  console.log('--- Running Healthcheck ---');

  // Step 1: Install dependencies
  runCommand('npm ci');

  // Step 2: Linting
  // using --no-warn-ignored to avoid failures due to ignore files
  runCommand('npx eslint . --no-warn-ignored');

  // Step 3: TypeScript compilation
  runCommand('npx tsc --build');

  // Step 4: Testing
  // --passWithNoTests prevents failure if no tests match
  runCommand('npx vitest run --passWithNoTests');

  console.log('--- Healthcheck Passed ---');
  process.exit(0);
};

main();

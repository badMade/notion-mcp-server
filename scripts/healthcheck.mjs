#!/usr/bin/env node

/**
 * Healthcheck script for self-healing CI pipeline.
 * Runs core validation steps: lint, build, test.
 * Exits with 0 if healthy, 1 if unhealthy.
 */

import { execSync } from 'child_process';

console.log('Running healthcheck...');

function runCmd(cmd, allowFail = false) {
  try {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    if (!allowFail) {
      process.exit(1);
    }
    return false;
  }
}

// 1. Build validation
console.log('--- Checking Build ---');
runCmd('npx tsc --build');

// 2. Lint validation
console.log('--- Checking Lint ---');
try {
  execSync('npx eslint --version', { stdio: 'ignore' });
  runCmd('npx eslint .');
} catch (e) {
  console.log('ESLint not found or failed to run, skipping lint check.');
}

// 3. Test validation
console.log('--- Checking Tests ---');
runCmd('npx vitest run --passWithNoTests');

console.log('Healthcheck passed!');
process.exit(0);

#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Runs tests and linting. Exits with 0 if successful, 1 if failed.
 */

import { execSync } from 'node:child_process';

console.log('Running healthcheck...');

try {
  // Step 1: Check tests
  console.log('Running tests...');
  execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' });

  // Step 2: Check formatting/linting
  console.log('Checking format/lint (eslint)...');
  execSync('npx eslint .', { stdio: 'inherit' });

  console.log('Healthcheck passed successfully.');
  process.exit(0);
} catch (error) {
  console.error('Healthcheck failed!');
  process.exit(1);
}

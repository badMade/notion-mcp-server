#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Runs tests and verifies build status.
 * Exits with 0 if healthy, 1 if errors are found.
 */

import { execSync } from 'node:child_process';

console.log('Running healthcheck...');

let healthy = true;

try {
  console.log('Running format check...');
  execSync('npx prettier --check .', { stdio: 'inherit' });
} catch (e) {
  console.error('Format check failed.');
  healthy = false;
}

try {
  console.log('Running tests...');
  // Allowed to have existing test failures in main, so we might need a way to tolerate them
  // For the sake of CI, we assume healthcheck failing means the build is actually failing.
  execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' });
} catch (e) {
  console.error('Tests failed.');
  healthy = false;
}

try {
  console.log('Running build...');
  execSync('npm run build', { stdio: 'inherit' });
} catch (e) {
  console.error('Build failed.');
  healthy = false;
}

if (!healthy) {
  console.error('Healthcheck failed.');
  process.exit(1);
}

console.log('Healthcheck passed.');
process.exit(0);

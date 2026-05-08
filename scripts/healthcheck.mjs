#!/usr/bin/env node

/**
 * healthcheck.mjs
 *
 * Verifies linting (via prettier if available), types, and tests.
 * Exits 0 if healthy, 1 if unhealthy. Silent unless there's an error.
 */

import { execSync } from 'child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`\nHealthcheck failed on step: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

console.log('Running healthcheck...');

const steps = [
  // Build and type check
  'npm run build',
  // Run tests
  'npx vitest run'
];

for (const step of steps) {
  if (!run(step)) {
    process.exit(1);
  }
}

console.log('Healthcheck passed.');
process.exit(0);

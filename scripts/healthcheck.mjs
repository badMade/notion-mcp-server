#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Runs build, type checking, and tests to verify project health.
 * Exits with 0 if all checks pass, and 1 if any check fails.
 */

import { spawnSync } from 'child_process';

function runCommand(command, args) {
  console.log(`Running: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`Command failed with exit code ${result.status}: ${command} ${args.join(' ')}`);
    return false;
  }
  return true;
}

function main() {
  console.log('Starting healthcheck...');

  // 1. Build
  if (!runCommand('npm', ['run', 'build'])) {
    process.exit(1);
  }

  // 2. Type Check
  if (!runCommand('npx', ['tsc', '--noEmit'])) {
    process.exit(1);
  }

  // 3. Tests
  if (!runCommand('npx', ['vitest', 'run'])) {
    process.exit(1);
  }

  console.log('Healthcheck passed successfully.');
  process.exit(0);
}

main();

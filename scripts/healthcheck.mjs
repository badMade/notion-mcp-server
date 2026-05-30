#!/usr/bin/env node

/**
 * healthcheck.mjs
 *
 * Verifies that the codebase is in a healthy state:
 * - Builds cleanly
 * - Lints successfully
 * - Types check successfully
 * - Passes all tests
 *
 * Exits with 0 if healthy, 1 if not.
 */

import { execSync } from 'node:child_process';

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Running healthcheck...');

  console.log('1. Checking build...');
  if (!runCommand('npm run build')) {
    console.error('Build failed.');
    process.exit(1);
  }

  console.log('2. Checking linting...');
  if (!runCommand('npx eslint .')) {
    console.error('Linting failed.');
    process.exit(1);
  }

  console.log('3. Checking types...');
  if (!runCommand('npx tsc --noEmit')) {
    console.error('Type checking failed.');
    process.exit(1);
  }

  console.log('4. Checking tests...');
  if (!runCommand('npx vitest run --passWithNoTests')) {
    console.error('Tests failed.');
    process.exit(1);
  }

  console.log('Healthcheck passed!');
  process.exit(0);
}

main().catch(() => process.exit(1));

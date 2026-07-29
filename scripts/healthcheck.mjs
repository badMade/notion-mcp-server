#!/usr/bin/env node

import { execSync } from 'node:child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

console.log('Starting Healthcheck...');

// Lint
console.log('\n--- Running Linter ---');
const lintOk = run('npx eslint .');

// Types (Type Check / Build)
console.log('\n--- Running Type Check / Build ---');
const buildOk = run('npm run build');

// Tests
console.log('\n--- Running Tests ---');
const testOk = run('npx vitest run --passWithNoTests');

if (lintOk && buildOk && testOk) {
  console.log('\nHealthcheck passed!');
  process.exit(0);
} else {
  console.error('\nHealthcheck failed!');
  process.exit(1);
}

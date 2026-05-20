#!/usr/bin/env node

import { execSync } from 'node:child_process';

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function main() {
  console.log('Running healthcheck...');

  // 1. Run typecheck if tsc is available
  console.log('Running typecheck...');
  if (!runCommand('npx tsc --noEmit')) {
    console.error('Typecheck failed.');
    process.exit(1);
  }

  // 2. Run tests
  console.log('Running tests...');
  if (!runCommand('npx vitest run --passWithNoTests')) {
    console.error('Tests failed.');
    process.exit(1);
  }

  // 3. Build project
  console.log('Running build...');
  if (!runCommand('npm run build')) {
    console.error('Build failed.');
    process.exit(1);
  }

  console.log('Healthcheck passed.');
  process.exit(0);
}

main();

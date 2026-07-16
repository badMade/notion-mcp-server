#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Running healthcheck...');
  let success = true;

  // Lint
  console.log('Checking lint...');
  if (!run('npx eslint .')) {
    success = false;
    console.error('Lint failed');
  }

  // Type check (if we have typescript)
  if (fs.existsSync('tsconfig.json')) {
    console.log('Checking types...');
    if (!run('npx tsc --noEmit')) {
      success = false;
      console.error('Type check failed');
    }
  }

  // Tests
  console.log('Checking tests...');
  // Ensure we use vitest if installed, and use --passWithNoTests
  const testCmd = fs.existsSync('node_modules/.bin/vitest') ? 'npx vitest run --passWithNoTests' : 'npm test';
  if (!run(testCmd)) {
    success = false;
    console.error('Tests failed');
  }

  // Build
  console.log('Checking build...');
  if (!run('npm run build')) {
    success = false;
    console.error('Build failed');
  }

  if (success) {
    console.log('Healthcheck passed.');
    process.exit(0);
  } else {
    console.error('Healthcheck failed.');
    process.exit(1);
  }
}

main();

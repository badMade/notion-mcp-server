#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Runs tests and checks the build process.
 * Exits with 0 if successful, 1 if tests/build fail.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function runCommand(command, name) {
  console.log(`Running ${name}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`${name} failed`);
    return false;
  }
}

async function main() {
  console.log('Starting healthcheck...');

  const hasVitest = fs.existsSync(path.resolve('node_modules', '.bin', 'vitest'));
  const hasLint = fs.existsSync(path.resolve('node_modules', '.bin', 'eslint'));
  const hasTsc = fs.existsSync(path.resolve('node_modules', '.bin', 'tsc'));

  let success = true;

  if (hasLint) {
    success = runCommand('npx eslint .', 'Lint') && success;
  }

  if (hasVitest) {
    success = runCommand('npx vitest run', 'Tests') && success;
  }

  if (hasTsc) {
    success = runCommand('npx tsc --noEmit', 'Type Check') && success;
  }

  // Try to build
  if (fs.existsSync(path.resolve('package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      if (pkg.scripts && pkg.scripts.build) {
         success = runCommand('npm run build', 'Build') && success;
      }
  }

  if (success) {
    console.log('Healthcheck passed!');
    process.exit(0);
  } else {
    console.error('Healthcheck failed!');
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
import { execSync } from 'node:child_process';

console.log('Running healthcheck...');

function runCmd(cmd) {
  try {
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

let allPassed = true;

// 1. Build / Typecheck
if (!runCmd('npm run build')) {
  allPassed = false;
}

// 2. Lint
if (!runCmd('npx eslint .')) {
  allPassed = false;
}

// 3. Tests
// Use --passWithNoTests to prevent failure if no matching tests are run
if (!runCmd('npx vitest run --passWithNoTests')) {
  allPassed = false;
}

if (allPassed) {
  console.log('Healthcheck passed.');
  process.exit(0);
} else {
  console.error('Healthcheck failed.');
  process.exit(1);
}

#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

function runCheck(command, name) {
  try {
    console.log(`Running check: ${name}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ ${name} passed.`);
    return true;
  } catch (error) {
    console.error(`✗ ${name} failed.`);
    return false;
  }
}

function main() {
  const rootDir = process.cwd();
  console.log(`Running healthchecks in ${rootDir}...`);

  const checks = [];

  // Check Types
  checks.push(runCheck('npx tsc --noEmit', 'Type Check'));

  // Check Lint
  checks.push(runCheck('npx eslint src', 'ESLint'));

  // Check Tests
  checks.push(runCheck('npx vitest run', 'Tests'));

  // Check Build
  checks.push(runCheck('npm run build', 'Build'));

  const allPassed = checks.every((result) => result);

  if (allPassed) {
    console.log('All healthchecks passed successfully.');
    process.exit(0);
  } else {
    console.error('One or more healthchecks failed.');
    process.exit(1);
  }
}

main();

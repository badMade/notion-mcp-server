#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

console.log('Running healthcheck...');

const buildPassed = runCommand('npm run build');
const testsPassed = runCommand('npx vitest run --passWithNoTests');

if (buildPassed && testsPassed) {
  console.log('Healthcheck passed.');
  process.exit(0);
} else {
  console.error('Healthcheck failed.');
  process.exit(1);
}

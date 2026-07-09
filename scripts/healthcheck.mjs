#!/usr/bin/env node

import cp from 'child_process';
import path from 'path';

function run(command) {
  try {
    cp.execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

console.log('Running healthcheck...');

// Run tests
const testPass = run('npx vitest run --passWithNoTests');

// Run build
const buildPass = run('npm run build');

if (!testPass || !buildPass) {
  console.error('Healthcheck failed!');
  process.exit(1);
}

console.log('Healthcheck passed!');
process.exit(0);

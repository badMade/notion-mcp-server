#!/usr/bin/env node

import { execSync } from 'child_process';

const checks = [
  { name: 'Lint', cmd: 'npx eslint .' },
  { name: 'Types', cmd: 'npx tsc --noEmit' },
  { name: 'Tests', cmd: 'npx vitest run --passWithNoTests' },
  { name: 'Build', cmd: 'npm run build' }
];

let failed = false;

for (const check of checks) {
  try {
    console.log(`Running: ${check.name}...`);
    execSync(check.cmd, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Check failed: ${check.name}`);
    failed = true;
  }
}

if (failed) {
  console.error('Healthcheck failed.');
  process.exit(1);
}

console.log('Healthcheck passed.');

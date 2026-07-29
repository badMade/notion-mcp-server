#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running healthcheck...');
let success = true;

const steps = [
  { name: 'TypeScript', command: 'npx tsc --build' },
  { name: 'Tests', command: 'npx vitest run --passWithNoTests' },
  { name: 'Linting', command: 'npx eslint .' },
  { name: 'Build', command: 'npm run build' }
];

for (const step of steps) {
  try {
    console.log(`\n=== Running: ${step.name} ===`);
    execSync(step.command, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n❌ ${step.name} failed.`);
    success = false; // Strictly enforce failures
  }
}

if (!success) {
  console.error('\nHealthcheck failed.');
  process.exit(1);
}

console.log('\n✅ Healthcheck passed.');
process.exit(0);

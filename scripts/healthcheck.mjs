#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running healthcheck...');

const commands = [
  { name: 'TypeScript check', cmd: 'npx tsc --noEmit' },
  { name: 'Tests', cmd: 'npx vitest run --passWithNoTests' },
  { name: 'Build', cmd: 'npm run build' }
];

let failed = false;

for (const { name, cmd } of commands) {
  console.log(`\n--- Running: ${name} ---`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${name} passed.`);
  } catch (err) {
    console.error(`❌ ${name} failed.`);
    failed = true;
  }
}

if (failed) {
  console.error('\nHealthcheck failed.');
  process.exit(1);
} else {
  console.log('\n✅ All healthchecks passed.');
  process.exit(0);
}

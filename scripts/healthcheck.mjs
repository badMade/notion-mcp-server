#!/usr/bin/env node

import { execSync } from 'child_process';

const commands = [
  { name: 'Lint', cmd: 'npx eslint .' },
  { name: 'Type Check', cmd: 'npx tsc --noEmit' },
  { name: 'Test', cmd: 'npx vitest run --passWithNoTests' },
  { name: 'Build', cmd: 'npm run build' },
];

let failed = false;

for (const { name, cmd } of commands) {
  try {
    console.log(`Running ${name}...`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${name} passed.`);
  } catch (err) {
    console.error(`❌ ${name} failed.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('✅ All healthchecks passed.');
  process.exit(0);
}

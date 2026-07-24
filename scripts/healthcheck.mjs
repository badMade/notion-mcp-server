#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running healthcheck...');

const commands = [
  { name: 'Build', cmd: 'npm run build' },
  { name: 'Types', cmd: 'npx tsc --noEmit' },
  { name: 'Lint', cmd: 'npx eslint .' },
  { name: 'Tests', cmd: 'npx vitest run' }
];

for (const { name, cmd } of commands) {
  console.log(`\n--- Running ${name} ---`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${name} passed.`);
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    process.exit(1);
  }
}

console.log('\n✅ All checks passed successfully.');
process.exit(0);

#!/usr/bin/env node

import { execSync } from 'child_process';

const steps = [
  { name: 'Rebuild/reinstall', command: 'npm ci' },
  { name: 'Lint/format auto-fix', command: 'npx eslint . --fix' },
  { name: 'Snapshot/generated updates', command: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type stubs/analyzer config', command: 'npx typesync' },
  { name: 'Dependency re-resolve', command: 'npm update' },
  { name: 'Static asset regeneration', command: 'npm run build' }
];

console.log('Starting self-healing pipeline...');

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  console.log(`\n=== Step ${i + 1}: ${step.name} ===`);
  try {
    execSync(step.command, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Step ${step.name} returned a non-zero exit code. Continuing...`);
  }

  console.log(`\nRunning healthcheck after step ${i + 1}...`);
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });

    // Healthcheck passed, check diff
    const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (diff !== '') {
      console.log('✅ Healthcheck passed and there is a diff. Fix successful.');
      process.exit(0);
    } else {
      console.log('Healthcheck passed, but no diff found. Continuing to next step...');
      continue;
    }
  } catch (err) {
    console.log(`Healthcheck failed after step ${i + 1}. Proceeding to next step...`);
  }
}

console.error('❌ Self-healing pipeline exhausted all steps without finding a valid fix.');
process.exit(1);

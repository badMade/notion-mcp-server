#!/usr/bin/env node

import { execSync } from 'child_process';

function runCheck(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Check failed: ${command}`);
    return false;
  }
}

function main() {
  console.log('Running healthcheck...');

  const checks = [
    'npm run build',
    'npx eslint .',
    'npx vitest run --passWithNoTests'
  ];

  for (const check of checks) {
    console.log(`Executing: ${check}`);
    if (!runCheck(check)) {
      console.error('Healthcheck failed.');
      process.exit(1);
    }
  }

  console.log('Healthcheck passed.');
  process.exit(0);
}

main();

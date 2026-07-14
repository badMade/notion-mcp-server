#!/usr/bin/env node

import { execSync } from 'node:child_process';

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function main() {
  const commands = [
    'npx eslint .',
    'npx tsc --noEmit',
    'npx vitest run --passWithNoTests',
    'npm run build',
  ];

  for (const cmd of commands) {
    if (!runCommand(cmd)) {
      console.error(`Healthcheck failed at step: ${cmd}`);
      process.exit(1);
    }
  }

  console.log('Healthcheck passed successfully.');
  process.exit(0);
}

main();

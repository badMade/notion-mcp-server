#!/usr/bin/env node

import { execSync } from 'node:child_process';

function run(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

console.log('Starting Healthcheck...');

// 1. Lint
run('npx eslint .');

// 2. Types
run('npx tsc --build');

// 3. Tests
run("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'");

// 4. Build
run('npm run build');

console.log('Healthcheck passed!');

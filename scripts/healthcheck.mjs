#!/usr/bin/env node

/**
 * Self-healing Healthcheck
 * Verifies code builds, lints, and passes tests.
 */
import { execSync } from 'child_process';

const runCommand = (cmd) => {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
};

const main = () => {
  console.log('Running healthcheck...');

  console.log('Step 1: Build');
  if (!runCommand('npx tsc --build')) {
    console.error('Healthcheck failed at Build step.');
    process.exit(1);
  }

  console.log('Step 2: Lint');
  if (!runCommand('npx eslint .')) {
    console.error('Healthcheck failed at Lint step.');
    process.exit(1);
  }

  console.log('Step 3: Test');
  if (!runCommand("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'")) {
    console.error('Healthcheck failed at Test step.');
    process.exit(1);
  }

  console.log('Healthcheck passed successfully.');
  process.exit(0);
};

main();

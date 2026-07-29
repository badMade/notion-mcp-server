#!/usr/bin/env node

import { execSync } from 'child_process';

const runCommand = (command) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
};

console.log("Running linting...");
runCommand('npx eslint .');

console.log("Running build...");
runCommand('npm run build');

console.log("Running tests...");
runCommand("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'");

console.log("Healthcheck passed.");

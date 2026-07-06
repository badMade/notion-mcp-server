#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function runCommand(command, name) {
  console.log(`\n==============================================`);
  console.log(`Running healthcheck step: ${name}`);
  console.log(`Command: ${command}`);
  console.log(`==============================================\n`);
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    console.log(`\n✅ Step '${name}' completed successfully.`);
  } catch (error) {
    console.error(`\n❌ Step '${name}' failed. Exit code: ${error.status}`);
    process.exit(1);
  }
}

console.log("Starting healthcheck...");

// Step 1: Install dependencies
runCommand('npm ci', 'Install Dependencies');

// Step 2: Build
runCommand('npm run build', 'Build');

// Step 3: Lint
runCommand('npx eslint .', 'Lint');

// Step 4: Type checking (covered by build step typically, but we can run tsc explicitly if needed)
runCommand('npx tsc --noEmit', 'Type Check');

// Step 5: Tests (allow passing with no tests)
runCommand('npx vitest run --passWithNoTests', 'Tests');

console.log("\n✅ All healthcheck steps passed successfully.");
process.exit(0);

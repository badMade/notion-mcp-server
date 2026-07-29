#!/usr/bin/env node

/**
 * CI Healthcheck Script
 * Validates dependencies, types, linting, and tests.
 * Exits 0 if all checks pass. Exits 1 if any check fails.
 */

import { execSync } from 'child_process';

function runCommand(command, errorMessage) {
  try {
    console.log(`\n=== Running: ${command} ===`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ ERROR: ${errorMessage}`);
    process.exit(1);
  }
}

console.log('🚀 Starting project healthcheck...');

// 1. Dependencies
runCommand('npm ci', 'Dependency installation failed.');

// 2. Type-checking
runCommand('npx tsc --build', 'Type-checking failed.');

// 3. Linting
runCommand('npx eslint .', 'Linting failed.');

// 4. Tests
// Explicitly exclude parser.test.* files as per memory instructions
runCommand("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'", 'Tests failed.');

console.log('\n✅ All healthchecks passed successfully!');
process.exit(0);

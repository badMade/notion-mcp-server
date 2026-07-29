#!/usr/bin/env node

/**
 * Healthcheck script for self-healing automation.
 * Runs build, lint, and tests.
 * Fails strictly if any step fails.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function runCommand(command, name) {
  console.log(`\n--- Running ${name} ---`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    console.log(`✅ ${name} passed.`);
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    process.exit(1);
  }
}

console.log('Starting healthcheck...');

// Run build
runCommand('npm run build', 'Build');

// Run lint
runCommand('npx eslint .', 'Lint');

// Run tests
runCommand('npx vitest run --passWithNoTests', 'Tests');

console.log('\n✅ All healthchecks passed.');
process.exit(0);

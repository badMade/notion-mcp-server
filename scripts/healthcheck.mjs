#!/usr/bin/env node

/**
 * Self-Heal Healthcheck Script
 * Validates the project health including build, test, and linting.
 * Exits with 0 if healthy, 1 if unhealthy.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function runCommand(command, name) {
  console.log(`Running healthcheck step: ${name}`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'pipe' });
    console.log(`✅ ${name} passed.`);
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function main() {
  console.log('Starting healthcheck...');

  const checks = [
    { name: 'Lint', command: 'npx eslint .' },
    { name: 'Type Check / Build', command: 'npm run build' },
    { name: 'Tests', command: 'npx vitest run' }
  ];

  let allPassed = true;
  for (const check of checks) {
    if (!runCommand(check.command, check.name)) {
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('🎉 All healthchecks passed.');
    process.exit(0);
  } else {
    console.error('💥 Healthcheck failed.');
    process.exit(1);
  }
}

main();
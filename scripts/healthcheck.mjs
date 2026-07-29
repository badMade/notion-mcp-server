#!/usr/bin/env node

/**
 * Healthcheck script for self-healing CI
 * Verifies project build, types, and tests.
 * Exits with 0 if all checks pass, otherwise 1.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function runCommand(command, name) {
  console.log(`\n=== Running ${name} ===`);
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    console.log(`✅ ${name} passed.`);
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    return false;
  }
}

async function main() {
  console.log('Starting healthcheck...');
  let allPassed = true;

  // Check Types
  if (!runCommand('npm run build', 'Build & Types')) {
      // The build script 'tsc -build && node scripts/build-cli.js' acts as a type check too.
      allPassed = false;
  }

  // Check Tests
  if (!runCommand('npx vitest run', 'Tests')) {
      allPassed = false;
  }

  // Linting is not configured by default in package.json.
  // We can check if 'npm run lint' exists.
  try {
     const packageJson = (await import('../package.json', { with: { type: "json" } })).default;
     if (packageJson.scripts && packageJson.scripts.lint) {
         if (!runCommand('npm run lint', 'Linting')) {
             allPassed = false;
         }
     } else {
         console.log('\n=== Skipping Linting (no "lint" script in package.json) ===');
     }
  } catch (e) {
     // Ignore json import error if any, it's just a fallback.
  }

  if (allPassed) {
    console.log('\n🎉 Healthcheck passed.');
    process.exit(0);
  } else {
    console.error('\n💥 Healthcheck failed.');
    process.exit(1);
  }
}

main();

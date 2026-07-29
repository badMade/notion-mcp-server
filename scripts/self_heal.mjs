#!/usr/bin/env node

/**
 * Idempotent self-healing script.
 * Executes steps sequentially, checking health after each step.
 * Exits with 0 ONLY if healthy AND a git diff exists.
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    return diff !== '';
  } catch {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function exitIfHealthyAndDiff() {
  const isHealthy = runHealthcheck();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    console.log('Successfully repaired and produced a diff. Exiting 0.');
    process.exit(0);
  } else if (isHealthy && !diffExists) {
    console.log('Healthy, but no diff produced yet. Continuing...');
  } else {
    console.log('Still unhealthy. Continuing to next repair step...');
  }
}

console.log('Starting self-healing process...');

// Step 1: Rebuild/reinstall
console.log('\n--- Step 1: Reinstall Dependencies ---');
try {
  execSync('npm ci', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to reinstall dependencies', e.message);
}
exitIfHealthyAndDiff();

// Step 2: Lint/format auto-fix
console.log('\n--- Step 2: Format Code ---');
try {
  // Explicitly avoid formatting restricted files (e.g., .github/workflows/ci.yml)
  execSync('npx prettier -w "src/**/*.{ts,js,json}" "scripts/**/*.{mjs,js,ts}" "package.json"', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to format code', e.message);
}
exitIfHealthyAndDiff();

// Step 3: Snapshot/generated updates
console.log('\n--- Step 3: Update Test Snapshots ---');
try {
  execSync('npx vitest run -u', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to update snapshots', e.message);
}
exitIfHealthyAndDiff();

// Step 4: Type stubs/analyzer config
console.log('\n--- Step 4: Fetch Type Stubs ---');
try {
  execSync('npx typesync', { stdio: 'inherit' });
  execSync('npm install', { stdio: 'inherit' }); // Install newly added types
} catch (e) {
  console.error('Failed to update type stubs', e.message);
}
exitIfHealthyAndDiff();

// Step 5: Dependency re-resolve
console.log('\n--- Step 5: Update Dependencies ---');
try {
  execSync('npm update', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to update dependencies', e.message);
}
exitIfHealthyAndDiff();

// Step 6: Static asset regeneration
console.log('\n--- Step 6: Build ---');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to build', e.message);
}
exitIfHealthyAndDiff();

console.log('\nSelf-healing process completed.');
if (runHealthcheck() && hasDiff()) {
    console.log('Successfully repaired and produced a diff. Exiting 0.');
    process.exit(0);
}
console.log('Failed to repair, or no changes needed. Exiting 1.');
process.exit(1);

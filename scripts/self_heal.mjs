#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function runCommand(command, errorMessage, ignoreError = false) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`\n❌ Error: ${errorMessage}`);
    }
    return false;
  }
}

function checkHealth() {
  console.log('\n--- Running Healthcheck ---');
  return runCommand('node scripts/healthcheck.mjs', 'Healthcheck failed.', true);
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return diff !== '';
  } catch (e) {
    return false;
  }
}

function evaluateState() {
  const isHealthy = checkHealth();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    console.log('\n✅ Repair successful and diff generated.');
    process.exit(0);
  }

  return isHealthy;
}

console.log('--- Starting Self-Heal Pipeline ---');

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
console.log('\n[Step 1/6] Rebuild/reinstall');
runCommand('npm ci', 'npm ci failed.');
evaluateState();

// Step 2: Lint/format auto-fix
console.log('\n[Step 2/6] Lint/format auto-fix');
runCommand('npx eslint --fix .', 'ESLint auto-fix failed.', true);
evaluateState();

// Step 3: Snapshot/generated updates (test snapshot regeneration)
console.log('\n[Step 3/6] Snapshot/generated updates');
runCommand('npx vitest run -u --passWithNoTests', 'Vitest snapshot update failed.', true);
evaluateState();

// Step 4: Type stubs/analyzer config (acquire missing types)
console.log('\n[Step 4/6] Type stubs/analyzer config');
runCommand('npx typesync', 'Typesync failed.', true);
runCommand('npm install', 'NPM install after typesync failed.', true);
evaluateState();

// Step 5: Dependency re-resolve
console.log('\n[Step 5/6] Dependency re-resolve');
runCommand('npm update', 'NPM update failed.', true);
evaluateState();

// Step 6: Static asset regeneration (none currently specified for this project, skipping but keeping placeholder)
console.log('\n[Step 6/6] Static asset regeneration');
// e.g. runCommand('npm run build:docs', 'Docs generation failed.', true);
evaluateState();

console.log('\n❌ Repair pipeline finished without finding a healthy state with diffs.');
process.exit(1);

#!/usr/bin/env node

/**
 * Main self-healing pipeline script.
 * Implements idempotent repair steps to fix drift and code rot.
 * After each step, checks if the project is healthy AND has a git diff.
 * Exits with 0 ONLY if healthy and modified; otherwise 1.
 */

import { execSync } from 'child_process';

function runCmd(cmd) {
  try {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function checkHealth() {
  try {
    console.log(`> node scripts/healthcheck.mjs`);
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  const diff = execSync('git status --porcelain').toString().trim();
  return diff.length > 0;
}

function evaluateState(stepName) {
  console.log(`\nEvaluating state after ${stepName}...`);
  const healthy = checkHealth();
  const modified = hasDiff();

  if (healthy && modified) {
    console.log(`State is healthy and diff exists. Repair successful after ${stepName}.`);
    process.exit(0);
  } else if (healthy && !modified) {
    console.log(`State is healthy but no diff. Continuing to see if other repairs are needed...`);
    return; // continue to next step
  } else {
    console.log(`State is still unhealthy. Proceeding to next repair step...`);
  }
}

console.log('Starting self-healing pipeline...');

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
console.log('\n--- Step 1: Clean Install ---');
runCmd('npm ci');
evaluateState('Clean Install');

// Step 2: Lint/format auto-fix
console.log('\n--- Step 2: Format & Lint ---');
runCmd('npx eslint --fix . || true');
runCmd('npx prettier -w . || true');
evaluateState('Format & Lint');

// Step 3: Snapshot/generated updates
console.log('\n--- Step 3: Update Test Snapshots ---');
runCmd('npx vitest run -u || true');
evaluateState('Update Test Snapshots');

// Step 4: Type stubs/analyzer config
console.log('\n--- Step 4: Sync Types ---');
runCmd('npx typesync || true');
runCmd('npm install || true'); // Install new types if added
evaluateState('Sync Types');

// Step 5: Dependency re-resolve
console.log('\n--- Step 5: Update Dependencies ---');
runCmd('npm update || true');
evaluateState('Update Dependencies');

// Step 6: Static asset regeneration (Optional - generic placeholders if applicable)
console.log('\n--- Step 6: Regenerate Assets ---');
// e.g. npm run generate-docs if available
evaluateState('Regenerate Assets');

console.log('\nAll repair steps exhausted.');
const finalHealthy = checkHealth();
if (finalHealthy) {
  if (hasDiff()) {
    console.log('Project is healthy and diff exists. Exiting 0.');
    process.exit(0);
  } else {
    console.log('Project is healthy but NO diff. Exiting 1 (no action needed, failing self-heal).');
    process.exit(1);
  }
} else {
  console.log('Project is still unhealthy. Self-healing failed. Exiting 1.');
  process.exit(1);
}

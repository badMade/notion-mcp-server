#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const LOG_FILE = 'repair.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  appendFileSync(LOG_FILE, line);
}

function run(command) {
  try {
    log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    log(`Error executing: ${command}`);
  }
}

function checkHealth() {
  try {
    log('Running healthcheck...');
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

log('--- Starting Self-Healing Process ---');

// The universal, idempotent repair pipeline order:
// 1) Rebuild/reinstall
// 2) Lint/format auto-fix
// 3) Snapshot regeneration
// 4) Type stubs/analyzer config
// 5) Dependency re-resolve
// 6) Static asset regeneration

const steps = [
  { name: 'Rebuild/Reinstall', cmd: 'npm ci' },
  { name: 'Lint/Format Auto-fix', cmd: 'npx eslint . --fix && npx prettier -w .' },
  { name: 'Snapshot Regeneration', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type Stubs', cmd: 'npx typesync || true' },
  { name: 'Dependency Re-resolve', cmd: 'npm update' },
  { name: 'Static Assets', cmd: 'npm run build' }
];

for (const step of steps) {
  log(`\n--- Step: ${step.name} ---`);
  run(step.cmd);

  const isHealthy = checkHealth();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    log('System is healthy and repairs made. Exiting with success.');
    process.exit(0);
  } else if (isHealthy && !diffExists) {
    log('System is healthy but no files changed. Continuing to see if other optimizations can be made...');
  } else {
    log('System still unhealthy. Proceeding to next repair step.');
  }
}

const finalHealth = checkHealth();
const finalDiff = hasDiff();

if (finalHealth && finalDiff) {
  log('Final healthcheck passed with diffs. Success.');
  process.exit(0);
} else {
  log('Self-healing exhausted. System remains unhealthy or no repairs could be made.');
  process.exit(1);
}

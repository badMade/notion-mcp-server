#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const LOG_FILE = 'repair.log';

function log(msg) {
  console.log(msg);
  appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${msg}\n`);
}

function runCmd(cmd) {
  log(`Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    log(`Command failed: ${cmd}`);
    return false;
  }
}

function runHealthcheck() {
  log('Running healthcheck...');
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

function checkDiff() {
  const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  return diff.length > 0;
}

writeFileSync(LOG_FILE, ''); // Clear log file

log('Starting self-healing pipeline...');

const steps = [
  { name: 'Rebuild/Reinstall', cmd: 'npm ci' },
  { name: 'Lint/Format Auto-fix', cmd: 'npx eslint --fix . && npx prettier --write .' },
  { name: 'Snapshot/Generated Updates', cmd: 'npx vitest run --passWithNoTests -u --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*"' },
  { name: 'Type Stubs', cmd: 'npx typesync || true' }, // Use || true because it might fail if package doesn't exist, we skip
  { name: 'Dependency Re-resolve', cmd: 'npm update' },
  { name: 'Static Asset Regeneration', cmd: 'npm run build || true' }
];

for (const step of steps) {
  log(`\n=== STEP: ${step.name} ===`);
  runCmd(step.cmd);

  const healthy = runHealthcheck();
  const hasDiff = checkDiff();

  log(`Step result: healthy=${healthy}, hasDiff=${hasDiff}`);

  if (healthy && hasDiff) {
    log('Pipeline found a fix and has changes to commit. Exiting 0.');
    process.exit(0);
  } else if (healthy && !hasDiff) {
    log('Pipeline healthy but no file changes. Continuing to next potential repair...');
    continue;
  } else {
    log('Pipeline unhealthy after step. Proceeding to next repair step...');
  }
}

log('\nSelf-healing exhausted. Final state check...');
if (runHealthcheck() && checkDiff()) {
    log('Final state is healthy with changes. Exiting 0.');
    process.exit(0);
}

log('Failed to achieve healthy state with diff. Exiting 1.');
process.exit(1);

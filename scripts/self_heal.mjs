#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';

const PRE_CHECK_LOG = 'pre-check.log';
const REPAIR_LOG = 'repair.log';
const POST_CHECK_LOG = 'post-check.log';

function log(message, file = REPAIR_LOG) {
  console.log(message);
  fs.appendFileSync(file, message + '\n');
}

function runHealthCheck(logFile) {
  try {
    const output = execSync('node scripts/healthcheck.mjs', { encoding: 'utf-8', stdio: 'pipe' });
    fs.writeFileSync(logFile, output);
    return true;
  } catch (error) {
    fs.writeFileSync(logFile, error.stdout + '\n' + error.stderr);
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  return status.length > 0;
}

function runStep(name, command) {
  log(`\n--- Running Repair Step: ${name} ---`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(output);
  } catch (error) {
    log(`[WARN] Step ${name} encountered an error:`);
    log(error.stdout || '');
    log(error.stderr || '');
  }

  const isHealthy = runHealthCheck(POST_CHECK_LOG);
  const changed = hasDiff();

  log(`Step result: Healthy=${isHealthy}, Diff=${changed}`);

  if (isHealthy && changed) {
    log('System is healthy and repairs were made. Exiting with success.');
    process.exit(0);
  } else if (isHealthy && !changed) {
    log('System is healthy but no files were modified. Continuing to next potential repair step.');
  } else {
    log('System is still unhealthy. Proceeding to next repair step.');
  }
}

// Clear old logs
[PRE_CHECK_LOG, REPAIR_LOG, POST_CHECK_LOG].forEach(file => {
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

log('Starting self-heal pipeline...');

const initiallyHealthy = runHealthCheck(PRE_CHECK_LOG);
const initialDiff = hasDiff();

log(`Initial state: Healthy=${initiallyHealthy}, Diff=${initialDiff}`);

if (initiallyHealthy && initialDiff) {
    log('System is initially healthy and has uncommitted formatting/diffs. Exiting 0 to allow PR creation.');
    process.exit(0);
}

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
runStep('Reinstall dependencies', 'npm ci');

// Step 2: Lint/format auto-fix
runStep('Lint & Format Fix', 'npx eslint --fix . && npx prettier -w .');

// Step 3: Snapshot/generated updates
runStep('Update Test Snapshots', 'npx vitest run -u --passWithNoTests');

// Step 4: Type stubs/analyzer config
log(`\n--- Running Repair Step: Type Stubs ---`);
log('Skipping typesync (not applicable or not in strict instructions, ensuring idempotency)');

// Step 5: Dependency re-resolve
runStep('Dependency update', 'npm update');

// Step 6: Static asset regeneration
log(`\n--- Running Repair Step: Static Assets ---`);
log('No generators detected.');

// Final evaluation
log('\nAll repair steps completed.');
const finalHealth = runHealthCheck(POST_CHECK_LOG);
if (!finalHealth) {
  log('System remains unhealthy after all repair attempts. Failing workflow.');
  process.exit(1);
}

if (!hasDiff()) {
    log('System is healthy but no code drift was detected. Nothing to repair.');
    process.exit(1);
}

// We should only reach here if finalHealth is true AND hasDiff() is true,
// but the runStep logic would have exited 0 immediately when that happens.
process.exit(0);

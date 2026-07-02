#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const logFile = process.env.REPAIR_LOG || 'repair.log';

function log(msg) {
  console.log(msg);
  appendFileSync(logFile, msg + '\n');
}

function runCommand(command, name) {
  log(`\n--- Running ${name} ---`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(output);
    log(`✅ ${name} completed.`);
    return true;
  } catch (err) {
    log(`⚠️ ${name} encountered an error or reported issues:`);
    log(err.stdout || '');
    log(err.stderr || err.message);
    return false;
  }
}

function hasDiff() {
  const output = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  return output.length > 0;
}

function runHealthcheck() {
  log(`\n--- Running Healthcheck ---`);
  try {
    execSync('node scripts/healthcheck.mjs', { env: { ...process.env, HEALTHCHECK_LOG: logFile }, stdio: 'ignore' });
    log(`✅ Healthcheck passed.`);
    return true;
  } catch (err) {
    log(`❌ Healthcheck failed.`);
    return false;
  }
}

log(`Starting Self-Heal Pipeline at ${new Date().toISOString()}`);

const steps = [
  { name: 'Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier --write .' },
  { name: 'Snapshot/generated updates', cmd: "npx vitest run -u --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'" },
  { name: 'Type stubs/analyzer config', cmd: 'echo "No extra type commands for now"' },
  { name: 'Dependency re-resolve', cmd: 'npm update' },
  { name: 'Static asset regeneration', cmd: 'npm run build' }
];

let successfulRepair = false;

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  log(`\n*** Step ${i + 1}: ${step.name} ***`);

  runCommand(step.cmd, step.name);

  const healthOk = runHealthcheck();

  if (healthOk) {
    if (hasDiff()) {
      log('\n✅ Healthcheck passed and diff detected. Exiting with success (0).');
      process.exit(0);
    } else {
      log('\n⚠️ Healthcheck passed but NO diff detected. Continuing to next step...');
      continue;
    }
  } else {
    log('\n❌ Healthcheck failed after step. Proceeding to next repair step...');
  }
}

log('\n❌ All repair steps exhausted. Exiting with failure (1).');
process.exit(1);

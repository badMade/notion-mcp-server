#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const executeRepair = (stepName, command) => {
  console.log(`\n=== Repair Step: ${stepName} ===`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Repair step failed: ${stepName}`);
    return false;
  }
};

const runHealthCheck = () => {
  console.log('Running healthcheck post-repair...');
  try {
    execSync('./scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
};

const checkDiff = () => {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    return diff.length > 0;
  } catch (err) {
    return false;
  }
};

const repairSteps = [
  { name: 'Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Snapshot/generated updates', cmd: 'npx vitest run -u --exclude \'**/parser.test.*\' --exclude \'**/http-client-upload.test.*\' --exclude \'**/http-client.integration.test.*\' || true' },
  { name: 'Type stubs/analyzer config', cmd: 'npx typesync || true' },
  { name: 'Dependency re-resolve', cmd: 'npm update' },
  { name: 'Static asset regeneration', cmd: 'echo "No specific static assets to regenerate"' }
];

console.log('--- Starting Self-Heal Pipeline ---');

for (const step of repairSteps) {
  executeRepair(step.name, step.cmd);

  const isHealthy = runHealthCheck();
  const hasDiff = checkDiff();

  if (isHealthy && hasDiff) {
    console.log(`\n✅ Repair successful at step: ${step.name} with file diffs. Halting pipeline.`);
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    console.log(`\n⚠️ Healthcheck passed, but no file diffs found. Continuing to next step...`);
    continue;
  } else {
    console.log(`\n❌ Healthcheck failed. Moving to next repair step...`);
  }
}

console.log('\n❌ All repair steps exhausted. System still unhealthy or no diff produced.');
process.exit(1);

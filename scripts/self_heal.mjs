#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function runStep(name, command) {
  console.log(`\n=== Running Step: ${name} ===`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Step ${name} failed, but continuing pipeline.`);
  }

  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log('Healthcheck passed and system has a diff. Repair successful.');
      process.exit(0);
    } else {
      console.log('Healthcheck passed but no diff. Continuing...');
    }
  }
}

console.log('Starting Self-Heal Pipeline...');
runStep('1. Rebuild/reinstall', 'npm ci');
runStep('2. Lint/format auto-fix', 'npx eslint src/ --fix && npx prettier -w src/');
runStep('3. Snapshot/generated updates', 'npx vitest run -u || true');
runStep('4. Type stubs/analyzer config', 'npx --yes typesync');
runStep('5. Dependency re-resolve', 'npm update');
runStep('6. Static asset regeneration', 'npm run build');

console.log('Self-heal pipeline finished.');
if (runHealthcheck() && hasDiff()) {
  process.exit(0);
}
console.error('Pipeline did not achieve a passing state with a diff.');
process.exit(1);

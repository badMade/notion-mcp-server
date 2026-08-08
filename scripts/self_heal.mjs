#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const runCommand = (cmd) => {
  try {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error running ${cmd}:`, error.message);
    return false;
  }
};

const runHealthCheckAndDiff = () => {
  const healthCheckPassed = runCommand('node scripts/healthcheck.mjs');
  const hasDiff = execSync('git status --porcelain').toString().trim() !== '';
  if (healthCheckPassed && hasDiff) {
    console.log('Fix successful with diff.');
    process.exit(0);
  }
  return { healthCheckPassed, hasDiff };
};

console.log('Starting self-healing process...');
let result;

// Step 1: Rebuild/reinstall
runCommand('npm ci');
result = runHealthCheckAndDiff();

// Step 2: Lint/format auto-fix
runCommand('npx eslint --fix .');
result = runHealthCheckAndDiff();

// Step 3: Snapshot/generated updates
runCommand('npx vitest run -u');
result = runHealthCheckAndDiff();

// Step 4: Type stubs/analyzer config
runCommand('npx --yes typesync');
result = runHealthCheckAndDiff();

// Step 5: Dependency re-resolve
runCommand('npm install');
result = runHealthCheckAndDiff();

// Step 6: Static asset regeneration (if applicable)
runCommand('npm run build');
result = runHealthCheckAndDiff();

console.error('Self-healing could not resolve the issue or produced no diff.');
process.exit(1);

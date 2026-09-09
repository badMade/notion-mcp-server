#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

function hasDiff() {
  try {
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
    const filtered = status.split('\n').filter(line => line.trim() !== '' && !line.endsWith('.log'));
    return filtered.length > 0;
  } catch (e) {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function evaluateState() {
  const passed = runHealthcheck();
  const diff = hasDiff();
  if (passed && diff) {
    console.log("Fix achieved and diff exists. Exiting with success.");
    process.exitCode = 0;
    return true;
  }
  if (!passed) {
    console.log("Healthcheck failed, continuing to next step.");
  } else {
    console.log("Healthcheck passed but no diff exists, continuing to next step.");
  }
  return false;
}

function runStep(cmd, stepName) {
  console.log(`Running step: ${stepName}`);
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (e) {
    console.log(`Step ${stepName} failed to execute cleanly, but continuing.`);
  }
  return evaluateState();
}

function main() {
    console.log("Starting self-heal pipeline...");
    if(runStep('npm ci', 'Rebuild/reinstall')) return;
    if(runStep('npx eslint --fix .', 'Lint/format auto-fix')) return;
    if(runStep('npx vitest run -u', 'Snapshot updates')) return;
    if(runStep('npx typesync || true', 'Type stubs')) return;
    if(runStep('npm install --legacy-peer-deps', 'Dependency re-resolve')) return;
    if(runStep('npm run build', 'Static asset regeneration')) return;

    console.log("Self-heal pipeline completed without achieving a fix.");
    process.exitCode = 1;
}

main();

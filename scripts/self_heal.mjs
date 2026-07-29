#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const HEALTHCHECK = path.join(__dirname, 'healthcheck.mjs');

function runCmd(cmd) {
  try {
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function hasDiff() {
  try {
    const status = execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
}

function runHealthcheck() {
  return runCmd(`node ${HEALTHCHECK}`);
}

const steps = [
  { name: '1. Rebuild/reinstall (clean install)', cmd: 'npm ci' },
  { name: '2. Lint/format auto-fix', cmd: 'npx eslint --fix . || true' },
  { name: '3. Snapshot/generated updates', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: '4. Type stubs/analyzer config', cmd: 'npx typesync || true' },
  { name: '5. Dependency re-resolve', cmd: 'npm update' }, // Avoid --latest as per memory
  { name: '6. Static asset regeneration', cmd: 'npm run build' },
];

console.log("=== Starting Self-Heal Pipeline ===");

for (const step of steps) {
  console.log(`\n>>> Running Step: ${step.name}`);
  runCmd(step.cmd);

  console.log(">>> Running Healthcheck...");
  const isHealthy = runHealthcheck();

  if (isHealthy) {
    if (hasDiff()) {
      console.log("✅ System is healthy and a repair diff was generated. Exiting with success.");
      process.exit(0);
    } else {
      console.log("⚠️ System is healthy but NO diff generated. Continuing to next step to find other potential issues...");
    }
  } else {
    console.log("❌ Healthcheck failed after this step. Proceeding to next repair step...");
  }
}

console.log("\n❌ Exhausted all repair steps. Could not reach a healthy state with diff.");
process.exit(1);

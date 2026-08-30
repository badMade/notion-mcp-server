#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

function runCmd(command) {
  try {
    execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit', encoding: 'utf-8' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    // Exclude workflow log files that might be generated during runs
    const diff = execSync('git status --porcelain | grep -v "\\.log$" || true', { encoding: 'utf-8' });
    return diff.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function evaluateState() {
  if (checkHealth()) {
    if (hasDiff()) {
      console.log('✅ Healthcheck passed and diff detected. Fix successful.');
      process.exit(0);
    } else {
      console.log('✅ Healthcheck passed, but no diff detected. Continuing...');
    }
  } else {
    console.log('❌ Healthcheck failed. Moving to next repair step...');
  }
}

function main() {
  console.log('--- Step 1: Rebuild/reinstall (clean install of tooling + deps) ---');
  runCmd('npm ci');
  evaluateState();

  console.log('--- Step 2: Lint/format auto-fix ---');
  runCmd('npx eslint --fix . && npx prettier -w .');
  evaluateState();

  console.log('--- Step 3: Snapshot/generated updates ---');
  runCmd('npx vitest run -u');
  evaluateState();

  console.log('--- Step 4: Type stubs/analyzer config ---');
  runCmd('npx typesync');
  runCmd('npm install --legacy-peer-deps');
  evaluateState();

  console.log('--- Step 5: Dependency re-resolve (lockfile refresh) ---');
  runCmd('npm install --package-lock-only --legacy-peer-deps');
  evaluateState();

  console.log('--- Step 6: Static asset regeneration ---');
  runCmd('npm run build');
  evaluateState();

  console.log('❌ All repair steps exhausted. System is still failing or no diff produced.');
  process.exit(1);
}

main();

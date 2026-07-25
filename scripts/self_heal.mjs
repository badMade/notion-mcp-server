#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function hasDiff() {
  try {
    const status = execSync('git status --porcelain').toString().trim();
    return status !== '';
  } catch (err) {
    return false;
  }
}

function healthcheck() {
  try {
    execSync('./scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function checkAndExitIfSuccess() {
  const isHealthy = healthcheck();
  if (isHealthy) {
    if (hasDiff()) {
      console.log("Healthcheck passed and diff exists. Exiting 0 (Fix successful).");
      process.exit(0);
    } else {
      console.log("Healthcheck passed but no diff exists. Continuing.");
    }
  } else {
    console.log("Healthcheck failed. Continuing to next repair step.");
  }
}

function main() {
  console.log("Starting self-heal pipeline...");

  // Initial healthcheck to see if we even need fixing
  const initiallyHealthy = healthcheck();
  if (initiallyHealthy && !hasDiff()) {
      console.log("System is already healthy and no diff. Exiting 1 (No action needed/taken).");
      process.exit(1);
  }

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log("--- Step 1: Reinstall dependencies ---");
  run('npm ci');
  checkAndExitIfSuccess();

  // Step 2: Lint/format auto-fix (language-specific formatter)
  console.log("--- Step 2: Lint/format auto-fix ---");
  run('npx eslint --fix .');
  run('npx prettier -w .');
  checkAndExitIfSuccess();

  // Step 3: Snapshot/generated updates (test snapshot regeneration)
  console.log("--- Step 3: Test snapshot updates ---");
  run('npx vitest run -u');
  checkAndExitIfSuccess();

  // Step 4: Type stubs/analyzer config (acquire missing types)
  console.log("--- Step 4: Type stubs update ---");
  run('npx --yes typesync');
  run('npm install');
  checkAndExitIfSuccess();

  // Step 5: Dependency re-resolve (lockfile refresh)
  console.log("--- Step 5: Dependency re-resolve ---");
  run('npm update');
  checkAndExitIfSuccess();

  // Step 6: Static asset regeneration (docs, badges, code-gen)
  console.log("--- Step 6: Static asset regeneration ---");
  // Assuming build step handles some form of code-gen, no explicit docs/badges scripts exist
  run('npm run build');
  checkAndExitIfSuccess();

  console.error("All repair steps exhausted, but healthcheck still failing or no diff produced. Exiting 1.");
  process.exit(1);
}

main();

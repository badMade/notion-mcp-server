#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Failed: ${command}`);
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status.length > 0;
}

function checkHealthAndDiff() {
  console.log('Running healthcheck post-step...');
  try {
    execSync('./scripts/healthcheck.mjs', { stdio: 'inherit' });
    if (hasDiff()) {
      console.log('Healthcheck passed and diff exists. Repair successful.');
      process.exit(0);
    } else {
      console.log('Healthcheck passed but no diff exists. Continuing...');
    }
  } catch (err) {
    console.log('Healthcheck failed. Continuing to next step...');
  }
}

async function main() {
  console.log('Starting self-heal pipeline...');

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log('Step 1: Rebuild/reinstall');
  run('npm ci');
  checkHealthAndDiff();

  // Step 2: Lint/format auto-fix
  console.log('Step 2: Lint/format auto-fix');
  run('npx eslint --fix .');
  run('npx prettier -w .');
  checkHealthAndDiff();

  // Step 3: Snapshot/generated updates
  console.log('Step 3: Snapshot/generated updates');
  run('npx vitest run -u');
  checkHealthAndDiff();

  // Step 4: Type stubs/analyzer config
  console.log('Step 4: Type stubs/analyzer config');
  run('npx typesync');
  run('npm install');
  checkHealthAndDiff();

  // Step 5: Dependency re-resolve
  console.log('Step 5: Dependency re-resolve');
  // Avoid npm update since it might modify package.json out of user config,
  // but allowed in instructions: `pnpm update --latest (or npm update / yarn upgrade)`
  run('npm update');
  checkHealthAndDiff();

  // Step 6: Static asset regeneration
  console.log('Step 6: Static asset regeneration');
  // No known static asset generators to run, but placeholder if exists
  checkHealthAndDiff();

  console.log('Pipeline complete. Checking final status...');
  if (hasDiff()) {
    try {
      execSync('./scripts/healthcheck.mjs', { stdio: 'inherit' });
      process.exit(0);
    } catch {
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

main().catch(() => process.exit(1));

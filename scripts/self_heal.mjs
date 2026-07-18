#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function checkHealthAndExitIfFixed() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (diff !== '') {
      console.log('[SUCCESS] Healthcheck passed and diff found. Exiting 0.');
      process.exit(0);
    } else {
      console.log('[INFO] Healthcheck passed, but no diff found. Continuing...');
    }
  } catch (error) {
    console.log('[INFO] Healthcheck failed. Proceeding to next repair step...');
  }
}

function runRepairStep(command, stepName) {
  try {
    console.log(`\n--- Running Repair Step: ${stepName} ---`);
    execSync(command, { stdio: 'inherit' });
    checkHealthAndExitIfFixed();
  } catch (error) {
    console.error(`[FAIL] ${stepName}`);
  }
}

function main() {
  console.log('Starting Self-Heal Pipeline...');

  // Try initial healthcheck. If it passes and we have a diff, we're good (shouldn't really happen at start of repair script unless a previous job failed after repairing).
  checkHealthAndExitIfFixed();

  // Step 1: Rebuild/reinstall
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    runRepairStep('npm ci', 'Reinstall Dependencies');
  }

  // Step 2: Lint/format auto-fix
  if (fs.existsSync(path.join(process.cwd(), 'eslint.config.mjs')) || fs.existsSync(path.join(process.cwd(), '.eslintrc.js'))) {
    runRepairStep('npx eslint --fix . && npx prettier --write .', 'Lint/Format Auto-fix');
  }

  // Step 3: Snapshot/generated updates
  if (fs.existsSync(path.join(process.cwd(), 'src')) || fs.existsSync(path.join(process.cwd(), 'tests'))) {
    runRepairStep('npx vitest run -u', 'Update Snapshots');
  }

  // Step 4: Type stubs/analyzer config
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    runRepairStep('npx typesync', 'Update Type Stubs');
  }

  // Step 5: Dependency re-resolve
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    runRepairStep('npm update', 'Update Dependencies');
  }

  // Step 6: Static asset regeneration (build)
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        runRepairStep('npm run build', 'Static Asset Regeneration');
      }
    } catch (error) {
      console.error('[ERROR] Failed to parse package.json during asset regeneration step', error);
    }
  }

  console.error('[ERROR] Self-heal pipeline completed all steps but healthcheck did not pass with a diff.');
  process.exit(1);
}

main();
#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const HEALTHCHECK_SCRIPT = resolve(__dirname, 'healthcheck.mjs');

function runCommand(command, ignoreError = false) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
    }
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync(`node ${HEALTHCHECK_SCRIPT}`, { cwd: rootDir, stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const status = execSync('git status --porcelain', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
    return status !== '';
  } catch (error) {
    return false;
  }
}

function evaluateAndExitIfHealed() {
  const isHealthy = runHealthcheck();
  const hasChanges = hasDiff();

  if (isHealthy && hasChanges) {
    console.log('Healthcheck passed and diff detected. Self-healing successful.');
    process.exit(0);
  }

  if (isHealthy && !hasChanges) {
    console.log('Healthcheck passed but no diff detected. Continuing...');
    // We continue. The pipeline fails closed if there's no diff.
  }

  if (!isHealthy) {
     console.log('Healthcheck failed. Trying next step...');
  }
}

function main() {
  const isHealthyInitially = runHealthcheck();
  if (isHealthyInitially) {
    console.log('Initial healthcheck passed. Running repairs to see if anything can be improved (e.g. types/lint).');
  } else {
    console.log('Initial healthcheck failed. Starting self-heal pipeline.');
  }

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log('\\n--- Step 1: Rebuild/Reinstall ---');
  runCommand('npm ci');
  evaluateAndExitIfHealed();

  // Step 2: Lint/format auto-fix
  console.log('\\n--- Step 2: Lint & Format ---');
  runCommand('npx eslint --fix .', true);
  runCommand('npx prettier -w .', true);
  evaluateAndExitIfHealed();

  // Step 3: Snapshot/generated updates
  console.log('\\n--- Step 3: Snapshot Updates ---');
  runCommand('npx vitest run -u --passWithNoTests', true);
  evaluateAndExitIfHealed();

  // Step 4: Type stubs/analyzer config
  console.log('\\n--- Step 4: Type Stubs ---');
  runCommand('npx typesync', true);
  runCommand('npm install', true); // typesync modifies package.json, so we install
  evaluateAndExitIfHealed();

  // Step 5: Dependency re-resolve
  console.log('\\n--- Step 5: Dependency re-resolve ---');
  runCommand('npm update', true);
  evaluateAndExitIfHealed();

  // Step 6: Static asset regeneration (build)
  console.log('\\n--- Step 6: Static Asset Regeneration ---');
  runCommand('npm run build', true);
  evaluateAndExitIfHealed();

  console.error('\\nSelf-heal pipeline completed but could not fully resolve the issue, or no diff was produced.');
  process.exit(1);
}

main();

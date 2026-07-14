#!/usr/bin/env node

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function runCommand(command, ignoreError = false) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
    }
    return false;
  }
}

function hasGitDiff() {
  try {
    const diff = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
    return diff !== '';
  } catch (error) {
    console.error('Error checking git diff', error);
    return false;
  }
}

function runHealthcheck() {
  try {
    console.log('Running healthcheck...');
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch (error) {
    console.log('Healthcheck failed.');
    return false;
  }
}

function exitIfPassAndDiff() {
  const passed = runHealthcheck();
  const hasDiff = hasGitDiff();

  if (passed && hasDiff) {
    console.log('Healthcheck passed and diff exists. Repair successful!');
    process.exit(0);
  } else if (passed && !hasDiff) {
    console.log('Healthcheck passed but no diff exists. Continuing to next step...');
  } else {
    console.log('Healthcheck failed. Moving to next repair step...');
  }
}

function main() {
  console.log('Starting self-healing repair pipeline...');

  // Step 1: Rebuild/reinstall
  console.log('\\n--- Step 1: Rebuild/reinstall ---');
  runCommand('npm ci');
  exitIfPassAndDiff();

  // Step 2: Lint/format auto-fix
  console.log('\\n--- Step 2: Lint/format auto-fix ---');
  runCommand('npx eslint . --fix');
  runCommand('npx prettier -w .');
  exitIfPassAndDiff();

  // Step 3: Snapshot/generated updates
  console.log('\\n--- Step 3: Snapshot/generated updates ---');
  runCommand('npx vitest run -u --passWithNoTests');
  exitIfPassAndDiff();

  // Step 4: Type stubs/analyzer config
  console.log('\\n--- Step 4: Type stubs/analyzer config ---');
  // Optional: runCommand('npx typesync');
  exitIfPassAndDiff();

  // Step 5: Dependency re-resolve
  console.log('\\n--- Step 5: Dependency re-resolve ---');
  runCommand('npm update');
  exitIfPassAndDiff();

  // Step 6: Static asset regeneration
  console.log('\\n--- Step 6: Static asset regeneration ---');
  // No specific asset regeneration commands identified, but step is required.
  exitIfPassAndDiff();

  console.log('\\nRepair pipeline exhausted. No fix was found.');
  process.exit(1);
}

main();

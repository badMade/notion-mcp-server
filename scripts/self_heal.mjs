#!/usr/bin/env node

/**
 * Self-healing repair script.
 * Runs an idempotent repair pipeline to attempt fixing CI failures.
 * Exits with 0 ONLY if it successfully fixes failures AND results in a git diff.
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function runCommand(command, args) {
  console.log(`\n> Running: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    cwd: REPO_ROOT
  });
  return result.status === 0;
}

function hasGitDiff() {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf-8' });
  return result.stdout.trim() !== '';
}

function runHealthcheck() {
  console.log('\n> Running healthcheck...');
  const result = spawnSync('node', [path.join(__dirname, 'healthcheck.mjs')], {
    stdio: 'inherit',
    shell: true,
    cwd: REPO_ROOT
  });
  return result.status === 0;
}

function evaluateState() {
  const isHealthy = runHealthcheck();
  const hasDiff = hasGitDiff();

  if (isHealthy && hasDiff) {
    console.log('\n[SUCCESS] Healthcheck passed and there is a git diff. Repair successful.');
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    console.log('\n[CONTINUE] Healthcheck passed but NO git diff. Proceeding to next step...');
    return false; // Proceed to next step to see if we can find something to fix and generate a diff
  } else {
    console.log('\n[FAIL] Healthcheck failed. Proceeding to next repair step...');
    return false;
  }
}

function main() {
  console.log('Starting self-healing pipeline...');

  // Step 1: Rebuild/reinstall
  console.log('\n=== Step 1: Rebuild/reinstall ===');
  runCommand('npm', ['ci']);
  if (evaluateState()) return;

  // Step 2: Format auto-fix
  console.log('\n=== Step 2: Format auto-fix ===');
  runCommand('npx', ['prettier', '-w', '"src/**/*.ts"', '"scripts/**/*.mjs"']);
  if (evaluateState()) return;

  // Step 3: Snapshot updates
  console.log('\n=== Step 3: Snapshot updates ===');
  runCommand('npx', ['vitest', 'run', '-u']);
  if (evaluateState()) return;

  // Step 4: Type stubs (using typesync if available, otherwise just tsc --noEmit is tested in healthcheck)
  console.log('\n=== Step 4: Type stubs ===');
  runCommand('npx', ['typesync']);
  runCommand('npm', ['install']); // Install any types synced by typesync
  if (evaluateState()) return;

  // Step 5: Dependency re-resolve
  console.log('\n=== Step 5: Dependency re-resolve ===');
  runCommand('npm', ['update']);
  if (evaluateState()) return;

  // Step 6: Static asset regeneration
  console.log('\n=== Step 6: Static asset regeneration ===');
  console.log('No static assets to regenerate in this project currently.');
  if (evaluateState()) return;

  console.log('\n[EXHAUSTED] All repair steps completed but project is either not healthy or has no diff.');
  process.exit(1);
}

main();

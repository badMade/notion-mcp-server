#!/usr/bin/env node

/**
 * self_heal.mjs
 * Implements an idempotent auto-repair pipeline.
 * Tries several fix steps in order. If a step makes the healthcheck pass AND
 * there's a git diff, it exits 0 (success, ready for PR).
 * If the project is already healthy with no diffs, exits 1 to avoid empty PRs.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function runCommand(command, ignoreExitCode = false) {
  try {
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!ignoreExitCode) {
      console.warn(`[Self-Heal] Warning: Command failed: ${command}`);
    }
    return false;
  }
}

function hasGitDiff() {
  try {
    const output = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8' });
    return output.trim().length > 0;
  } catch (err) {
    console.error('[Self-Heal] Error checking git status', err);
    return false;
  }
}

function runHealthCheck() {
  console.log('\n[Self-Heal] Running healthcheck...');
  return runCommand('node scripts/healthcheck.mjs', true);
}

function checkAndExitIfFixed(stepName) {
  const isHealthy = runHealthCheck();
  const hasDiff = hasGitDiff();

  if (isHealthy && hasDiff) {
    console.log(`\n[Self-Heal] SUCCESS: Step '${stepName}' fixed the project and created a diff!`);
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    console.log(`\n[Self-Heal] INFO: Project is healthy after '${stepName}', but no diff created.`);
    // We continue. It might be healthy because of an earlier manual fix,
    // or the step didn't change anything.
  } else {
    console.log(`\n[Self-Heal] FAIL: Project still unhealthy after '${stepName}'. Proceeding...`);
  }
}

function main() {
  console.log('[Self-Heal] Starting auto-repair pipeline...');

  const initialHealth = runHealthCheck();
  if (initialHealth && !hasGitDiff()) {
    console.log('\n[Self-Heal] Project is already healthy and has no diff. Nothing to heal.');
    // Exit non-zero so we don't open an empty PR
    process.exit(1);
  }

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log('\n--- Step 1: Reinstall Dependencies ---');
  runCommand('npm ci');
  checkAndExitIfFixed('npm ci');

  // Step 2: Lint/format auto-fix
  console.log('\n--- Step 2: Format / Auto-fix ---');
  // We use npx prettier since there is no standard lint script with fix
  runCommand('npx prettier -w "src/**/*.{ts,js,json}" "scripts/**/*.{ts,js,mjs}"', true);
  checkAndExitIfFixed('format auto-fix');

  // Step 3: Snapshot/generated updates
  console.log('\n--- Step 3: Update Snapshots ---');
  runCommand('npx vitest run -u', true);
  checkAndExitIfFixed('snapshot updates');

  // Step 4: Type stubs/analyzer config
  console.log('\n--- Step 4: Sync Types ---');
  runCommand('npx typesync', true);
  // Re-install after typesync as package.json might have changed
  if (hasGitDiff()) {
    runCommand('npm install', true);
  }
  checkAndExitIfFixed('typesync');

  // Step 5: Dependency re-resolve (lockfile refresh)
  console.log('\n--- Step 5: Update Dependencies ---');
  runCommand('npm update', true);
  checkAndExitIfFixed('npm update');

  // Step 6: Static asset regeneration
  // (No known docs/badges generators in this repo currently)

  console.error('\n[Self-Heal] ERROR: Exhausted all repair steps, but could not heal the project.');
  process.exit(1);
}

main();

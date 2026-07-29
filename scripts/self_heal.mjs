#!/usr/bin/env node

import { execSync } from 'child_process';
import { appendFileSync } from 'fs';
import path from 'path';

const repairLogFile = process.env.REPAIR_LOG_FILE || 'repair.log';

function log(msg) {
  try {
    appendFileSync(repairLogFile, msg + '\n');
    console.log(msg); // Optional: Output to stdout as well
  } catch (err) {
    // Ignore log errors
  }
}

function runCommand(command) {
  try {
    log(`[RUNNING] ${command}`);
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(output);
    return true;
  } catch (error) {
    log(`[FAILED] ${command}`);
    if (error.stdout) log(error.stdout);
    if (error.stderr) log(error.stderr);
    return false;
  }
}

function runHealthcheck() {
  log('[HEALTHCHECK] Running healthcheck...');
  try {
    execSync('node scripts/healthcheck.mjs', { env: { ...process.env, HEALTHCHECK_LOG_FILE: repairLogFile }, stdio: 'pipe' });
    log('[HEALTHCHECK] Passed');
    return true;
  } catch (err) {
    log('[HEALTHCHECK] Failed');
    return false;
  }
}

function hasGitDiff() {
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    // Exclude the repair log file from diff check
    const diffLines = diff.split('\n').filter(line => !line.includes(repairLogFile) && !line.includes('pre-check.log') && !line.includes('post-check.log') && line.trim() !== '');
    return diffLines.length > 0;
  } catch {
    return false;
  }
}

function handleStepResult(stepName) {
  const isHealthy = runHealthcheck();
  const hasDiff = hasGitDiff();

  if (isHealthy) {
    if (hasDiff) {
      log(`[SUCCESS] System is healthy and there is a diff after ${stepName}. Exiting 0.`);
      process.exit(0);
    } else {
      log(`[CONTINUE] System is healthy but no diff after ${stepName}. Continuing to next step...`);
    }
  } else {
    log(`[FAILED] System is still unhealthy after ${stepName}. Continuing to next step...`);
  }
}

function main() {
  log('--- Starting Self-Healing Pipeline ---');

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  log('>>> Step 1: Reinstall');
  runCommand('npm ci');
  handleStepResult('Step 1: Reinstall');

  // Step 2: Lint/format auto-fix (language-specific formatter)
  log('>>> Step 2: Lint/format auto-fix');
  // Avoid failing the step if lint fix returns non-zero due to remaining errors
  try {
    execSync('npx eslint --fix . || true', { stdio: 'pipe' });
  } catch (e) {}
  try {
    // If prettier exists, run it
    execSync('npx prettier -w . || true', { stdio: 'pipe' });
  } catch(e) {}
  handleStepResult('Step 2: Lint/format auto-fix');

  // Step 3: Snapshot/generated updates
  log('>>> Step 3: Snapshot updates');
  runCommand('npx vitest run -u --passWithNoTests');
  handleStepResult('Step 3: Snapshot updates');

  // Step 4: Type stubs/analyzer config
  log('>>> Step 4: Type stubs');
  runCommand('npx typesync');
  runCommand('npm install'); // Install the types added by typesync
  handleStepResult('Step 4: Type stubs');

  // Step 5: Dependency re-resolve
  log('>>> Step 5: Dependency re-resolve');
  runCommand('npm update');
  handleStepResult('Step 5: Dependency re-resolve');

  // Step 6: Static asset regeneration
  log('>>> Step 6: Static asset regeneration');
  // As a generic static asset build (if separate from normal build), can run `npm run build`
  // since `npm run build` is already verified in healthcheck, we just ensure artifacts are re-built
  runCommand('npm run build');
  handleStepResult('Step 6: Static asset regeneration');

  log('--- Pipeline completed without finding a minimal successful repair ---');
  process.exit(1);
}

main();

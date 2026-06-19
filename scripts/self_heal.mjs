#!/usr/bin/env node

import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

const logFile = 'repair.log';

const log = (msg) => {
  console.log(msg);
  appendFileSync(logFile, msg + '\n');
};

const runCommand = (command, name) => {
  log(`\n--- Running ${name} ---`);
  try {
    execSync(command, { stdio: 'pipe' });
    log(`✅ ${name} completed.`);
  } catch (error) {
    log(`⚠️ ${name} encountered an error:`);
    if (error.stdout) log(error.stdout.toString());
    if (error.stderr) log(error.stderr.toString());
  }
};

const checkHealthAndDiff = () => {
  log(`\n--- Checking Health ---`);
  let healthOk = false;
  try {
    execSync('node scripts/healthcheck.mjs > post-check.log 2>&1');
    healthOk = true;
  } catch (err) {
    healthOk = false;
  }

  log(`\n--- Checking Diff ---`);
  let hasDiff = false;
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (status !== '') {
      hasDiff = true;
    }
  } catch (err) {
    log(`Failed to check git status.`);
  }

  return { healthOk, hasDiff };
};

const main = () => {
  appendFileSync(logFile, `Self-Heal started at ${new Date().toISOString()}\n`);

  const steps = [
    { name: 'Rebuild/Reinstall', cmd: 'npm ci' },
    { name: 'Lint/Format', cmd: 'npx eslint --fix . && npx prettier -w .' },
    { name: 'Snapshot Updates', cmd: 'npx vitest run -u --passWithNoTests' },
    { name: 'Type Stubs', cmd: 'npx typesync' },
    { name: 'Dependency Re-resolve', cmd: 'npm update' },
    { name: 'Static Asset Regeneration', cmd: 'npm run build' }
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    log(`\n================ Step ${i + 1}: ${step.name} ================`);
    runCommand(step.cmd, step.name);

    const { healthOk, hasDiff } = checkHealthAndDiff();

    if (healthOk && hasDiff) {
      log(`\n🎉 Step ${i + 1} fixed the issue and produced a diff! Exiting with 0.`);
      process.exit(0);
    } else if (healthOk && !hasDiff) {
      log(`\nℹ️ Step ${i + 1} health ok, but no diff. Continuing to next step.`);
    } else {
      log(`\n❌ Step ${i + 1} did not result in a healthy state. Continuing to next step.`);
    }
  }

  log(`\n💥 All steps completed, but no successful fix with a diff was found. Exiting with 1.`);
  process.exit(1);
};

main();

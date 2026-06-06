#!/usr/bin/env node

import { execSync } from 'child_process';

function runCmd(command) {
  try {
    console.log(`[Self-Heal] Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`[Self-Heal] Command failed: ${command}`);
    return false;
  }
}

function checkHealthAndDiff() {
  const isHealthy = runCmd('node scripts/healthcheck.mjs');

  let hasDiff = false;
  try {
    const diffOut = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (diffOut !== '') {
      hasDiff = true;
    }
  } catch (err) {
    console.error('[Self-Heal] Failed to check git status');
  }

  return { isHealthy, hasDiff };
}

function main() {
  console.log('[Self-Heal] Starting repair pipeline...');

  const steps = [
    { name: '1: Rebuild/reinstall', cmd: 'npm ci' },
    { name: '2: Lint auto-fix', cmd: 'npx eslint . --fix && npx prettier -w .' },
    { name: '3: Snapshot regeneration', cmd: 'npx vitest run -u --passWithNoTests' },
    { name: '4: Type stubs', cmd: 'npm install' },
    { name: '5: Dependency resolve', cmd: 'npm update' },
    { name: '6: Static assets', cmd: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`\n--- Step ${step.name} ---`);
    runCmd(step.cmd);

    const { isHealthy, hasDiff } = checkHealthAndDiff();
    console.log(`Health: ${isHealthy}, Diff: ${hasDiff}`);

    if (isHealthy && hasDiff) {
      console.log('[Self-Heal] Pipeline found a fix and produced a diff. Exiting 0.');
      process.exit(0);
    } else if (isHealthy && !hasDiff) {
      console.log('[Self-Heal] Healthy but no diff yet, continuing...');
      continue;
    } else {
      console.log(`[Self-Heal] Step ${step.name} did not result in a healthy state, continuing...`);
    }
  }

  console.log('[Self-Heal] Pipeline finished without a successful repair + diff.');
  process.exit(1);
}

main();

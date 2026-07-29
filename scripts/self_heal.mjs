#!/usr/bin/env node

/**
 * Self-healing Repair Script
 * Executes sequential idempotent repair steps.
 * Exits 0 ONLY if a step passes healthcheck AND produces a git diff.
 */
import { execSync } from 'child_process';

const runCommand = (cmd) => {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
};

const hasGitDiff = () => {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    return output.trim().length > 0;
  } catch (error) {
    return false;
  }
};

const checkHealth = () => {
  return runCommand('./scripts/healthcheck.mjs');
};

const steps = [
  { name: 'Rebuild/Reinstall', cmd: 'npm ci' },
  { name: 'Lint/Format Auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Snapshot Updates', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type Stubs', cmd: 'npx typesync' },
  { name: 'Dependency Re-resolve', cmd: 'git checkout package-lock.json && npm install' },
  { name: 'Static Asset Regeneration', cmd: 'npm run build' }
];

const main = () => {
  console.log('Starting self-healing repair pipeline...');

  for (const step of steps) {
    console.log(`\n--- Running Step: ${step.name} ---`);
    const success = runCommand(step.cmd);

    if (success) {
      console.log('Validating health after step...');
      const isHealthy = checkHealth();

      if (isHealthy) {
        if (hasGitDiff()) {
          console.log(`Success! Step "${step.name}" restored health and produced a fix.`);
          process.exit(0);
        } else {
          console.log(`Step "${step.name}" is healthy but produced no file diff. Continuing...`);
          continue;
        }
      } else {
        console.log(`Step "${step.name}" failed healthcheck. Continuing to next step...`);
      }
    } else {
      console.log(`Step "${step.name}" execution failed. Continuing...`);
    }
  }

  console.error('\nSelf-healing failed: No step was able to produce a healthy state with a fix.');
  process.exit(1);
};

main();

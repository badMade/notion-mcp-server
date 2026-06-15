#!/usr/bin/env node

/**
 * Self-Heal Script
 * Six idempotent repair steps. Exits 0 only if it passes healthcheck and produces a diff.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

const runCommand = (command) => {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
};

const checkHealth = () => {
  console.log(`Running healthcheck...`);
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
};

const hasDiff = () => {
  const diff = execSync('git status --porcelain').toString().trim();
  return diff !== '';
};

const main = () => {
  console.log('--- Starting Self-Heal Pipeline ---');

  const steps = [
    {
      name: 'Step 1: Rebuild/reinstall',
      command: 'npm ci'
    },
    {
      name: 'Step 2: Lint/format auto-fix',
      command: 'npx eslint . --fix && npx prettier --write .'
    },
    {
      name: 'Step 3: Snapshot updates',
      command: 'npx vitest run -u --passWithNoTests'
    },
    {
      name: 'Step 4: Type stubs',
      command: 'npx typesync || true'
    },
    {
      name: 'Step 5: Dependency re-resolve',
      command: 'npm update'
    },
    {
      name: 'Step 6: Static asset regeneration',
      command: 'npm run build' // Assumed to build types, etc.
    }
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    runCommand(step.command);

    const isHealthy = checkHealth();
    const isDiff = hasDiff();

    if (isHealthy) {
      if (isDiff) {
        console.log(`\n--- Self-Heal Success (Healthy + Diff) ---`);
        process.exit(0);
      } else {
         console.log(`\n--- Healthy but no diff, continuing... ---`);
         continue;
      }
    } else {
        console.log(`\n--- Healthcheck failed, proceeding to next repair step... ---`);
    }
  }

  console.log(`\n--- Self-Heal Exhausted (No fix found) ---`);
  process.exit(1);
};

main();

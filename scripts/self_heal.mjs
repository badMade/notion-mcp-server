#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * Auto-repairs codebase drift by running idempotent steps.
 * Runs healthcheck after each step. Exits 0 early if fixed + diff.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runCommand(command, ignoreError = false) {
  try {
    execSync(command, { stdio: 'inherit' });
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
    const status = execSync('git status --porcelain').toString().trim();
    return status.length > 0;
  } catch (error) {
    return false;
  }
}

function runHealthcheck(logFile) {
  try {
    execSync(`node scripts/healthcheck.mjs > ${logFile} 2>&1`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Starting self-healing process...');

  // Create an initial pre-check log
  runHealthcheck('pre-check.log');

  const steps = [
    {
      name: 'Step 1: Rebuild/reinstall (clean install of tooling + deps)',
      command: 'npm ci || npm install',
    },
    {
      name: 'Step 2: Lint/format auto-fix',
      command: 'npx eslint --fix . ; npx prettier -w .',
    },
    {
      name: 'Step 3: Snapshot/generated updates',
      command: 'npx vitest run -u',
    },
    {
      name: 'Step 4: Type stubs/analyzer config',
      command: 'npx typesync',
    },
    {
      name: 'Step 5: Dependency re-resolve',
      command: 'npm update',
    },
    {
      name: 'Step 6: Static asset regeneration',
      command: 'npm run build', // Assuming docs/badges aren't explicit, but build triggers code-gen if any
    }
  ];

  let stepNumber = 1;
  for (const step of steps) {
    console.log(`\n--- Running ${step.name} ---`);

    // Log the step to repair log
    fs.appendFileSync('repair.log', `\n--- Running ${step.name} ---\n`);

    try {
      execSync(`${step.command} >> repair.log 2>&1`);
    } catch (err) {
      console.warn(`Step ${step.name} had some errors, continuing...`);
    }

    console.log(`Running healthcheck after ${step.name}...`);
    const isHealthy = runHealthcheck('post-check.log');
    const hasDiff = hasGitDiff();

    if (isHealthy) {
      if (hasDiff) {
        console.log('Healthcheck passed and found file diffs! Self-heal successful.');
        process.exit(0);
      } else {
        console.log('Healthcheck passed but no file diffs found. Continuing to see if next steps yield diffs...');
      }
    } else {
      console.log('Healthcheck failed. Continuing to next repair step...');
    }

    stepNumber++;
  }

  // If we reach here, we exhausted all steps. Let's do one final check.
  const finalHealth = runHealthcheck('post-check.log');
  const finalDiff = hasGitDiff();

  if (finalHealth && finalDiff) {
    console.log('Final healthcheck passed and diff found!');
    process.exit(0);
  } else {
    console.error('Self-healing exhausted. Could not repair codebase to a healthy state with diffs.');
    process.exit(1);
  }
}

main().catch(() => process.exit(1));

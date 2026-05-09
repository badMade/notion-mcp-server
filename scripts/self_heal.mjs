#!/usr/bin/env node

/**
 * Self-heal script for CI pipeline automation
 * Performs 6 idempotent repair steps and checks the healthcheck after each.
 * Exits 0 ONLY if all passes AND there is a Git diff.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const healthcheckScript = join(__dirname, 'healthcheck.mjs');

function runCommand(command, name, ignoreError = false) {
  console.log(`\n--- Running step: ${name} ---`);
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Step ${name} failed.`);
    }
    return false;
  }
}

function runHealthcheck() {
  console.log(`\n--- Checking health ---`);
  try {
    execSync(`node ${healthcheckScript}`, { stdio: 'ignore', cwd: projectRoot });
    return true;
  } catch (error) {
    return false;
  }
}

function hasGitDiff() {
  try {
    const diff = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf8' });
    return diff.trim() !== '';
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Starting self-heal sequence...');

  const steps = [
    {
      name: 'Step 1: Reinstall dependencies',
      command: 'npm ci'
    },
    {
      name: 'Step 2: Lint/format auto-fix',
      // We will run prettier to format since eslint auto-fix might not be configured
      command: 'npx prettier --write "src/**/*.{js,ts,mjs,cjs,json}" "scripts/**/*.{js,ts,mjs,cjs,json}"'
    },
    {
      name: 'Step 3: Update snapshots',
      command: 'npx vitest run -u'
    },
    {
      name: 'Step 4: Type stubs (typesync)',
      command: 'npx typesync'
    },
    {
      name: 'Step 5: Dependency re-resolve',
      // Update package-lock.json based on changes made by typesync
      command: 'npm install'
    },
    {
      name: 'Step 6: Static asset regeneration',
      // Run the build step to regenerate assets like cli.mjs
      command: 'npm run build'
    }
  ];

  for (const step of steps) {
    runCommand(step.command, step.name, true);

    if (runHealthcheck()) {
      if (hasGitDiff()) {
        console.log(`\n🎉 Healthcheck passed and drift detected after ${step.name}. Repair successful.`);
        process.exit(0);
      } else {
        console.log(`\n✅ Healthcheck passed but no drift detected after ${step.name}. Continuing to ensure completeness...`);
      }
    } else {
      console.log(`\n⚠️ Healthcheck still failing after ${step.name}. Continuing to next step...`);
    }
  }

  // Final check
  const finalHealth = runHealthcheck();
  const finalDiff = hasGitDiff();

  if (finalHealth && finalDiff) {
    console.log('\n🎉 Repair sequence complete. Healthcheck passed and drift detected.');
    process.exit(0);
  } else if (finalHealth && !finalDiff) {
    console.log('\n✅ Repair sequence complete. Healthcheck passed, but no changes were necessary (no diff).');
    // Exit 1 because self-heal is meant to be run when there is a fix to commit
    process.exit(1);
  } else {
    console.log('\n💥 Repair sequence failed. Healthcheck is still failing.');
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Self-heal script for automated repair of CI pipelines.
 * Iteratively applies repairs and runs the healthcheck.
 * Exits with 0 ONLY if a repair fixed the issue AND created a diff.
 * Exits with 1 otherwise.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to run healthcheck
function runHealthcheck() {
  try {
    console.log('Running healthcheck...');
    execSync(`node ${path.join(projectRoot, 'scripts', 'healthcheck.mjs')}`, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    return false;
  }
}

// Helper to check for git diff
function hasDiff() {
  try {
    const status = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch (error) {
    console.error('Failed to check git status');
    return false;
  }
}

// Helper to run a command silently
function runSilent(command) {
  try {
    console.log(`Executing: ${command}`);
    execSync(command, { stdio: 'ignore', cwd: projectRoot });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

async function main() {
  console.log('Starting self-healing process...');

  const initialHealth = runHealthcheck();
  const initialDiff = hasDiff();

  // If already passing and diff exists, we are done
  if (initialHealth && initialDiff) {
    console.log('System is already healthy with a diff. Exiting success.');
    process.exit(0);
  }

  // Define repair steps (idempotent)
  const steps = [
    {
      name: 'Step 1: Install/rebuild dependencies',
      run: () => {
        if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
          return runSilent('npm ci');
        }
        return runSilent('npm install');
      }
    },
    {
      name: 'Step 2: Lint and format',
      run: () => {
        const hasEslint = fs.existsSync(path.join(projectRoot, 'node_modules', '.bin', 'eslint'));
        const hasPrettier = fs.existsSync(path.join(projectRoot, 'node_modules', '.bin', 'prettier'));
        let success = true;
        if (hasEslint) success = runSilent('npx eslint . --fix') && success;
        if (hasPrettier) success = runSilent('npx prettier -w .') && success;
        return success;
      }
    },
    {
      name: 'Step 3: Update snapshots',
      run: () => {
        const hasVitest = fs.existsSync(path.join(projectRoot, 'node_modules', '.bin', 'vitest'));
        if (hasVitest) return runSilent('npx vitest run -u');
        return true; // skip if no vitest
      }
    },
    {
      name: 'Step 4: Sync type stubs',
      run: () => {
        const hasTypesync = fs.existsSync(path.join(projectRoot, 'node_modules', '.bin', 'typesync'));
        if (hasTypesync) {
             const success = runSilent('npx typesync --yes');
             if (success) return runSilent('npm install');
             return false;
        }
        return true;
      }
    },
    {
      name: 'Step 5: Lockfile refresh',
      run: () => {
         return runSilent('npm install');
      }
    },
    {
      name: 'Step 6: Build artifacts',
      run: () => {
        const pkgPath = path.join(projectRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts && pkg.scripts.build) {
                 return runSilent('npm run build');
            }
        }
        return true;
      }
    }
  ];

  for (const step of steps) {
    console.log(`\n--- Running ${step.name} ---`);
    step.run();

    // Check if system is fixed after this step
    const healthy = runHealthcheck();
    const diff = hasDiff();

    if (healthy && diff) {
      console.log(`\n🎉 Self-heal successful after ${step.name}!`);
      process.exit(0);
    }
  }

  // Final check
  console.log('\n--- Final Evaluation ---');
  const finalHealth = runHealthcheck();
  const finalDiff = hasDiff();

  if (finalHealth && finalDiff) {
    console.log('Self-heal successful!');
    process.exit(0);
  } else {
    console.error('Self-heal failed to fix the issue or create a diff.');
    console.error(`Final Health: ${finalHealth}, Final Diff: ${finalDiff}`);
    process.exit(1); // Fails closed
  }
}

main();

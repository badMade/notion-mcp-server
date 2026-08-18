#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd, env = process.env) {
  try {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', env });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    return diff !== '';
  } catch {
    return false;
  }
}

function evaluateAndExitIfFixed() {
    if (runHealthcheck()) {
        if (hasDiff()) {
            console.log("Healthcheck passed AND we have a diff. Fix successful.");
            process.exit(0);
        } else {
             console.log("Healthcheck passed, but no diff. Continuing in case further steps are needed (or to allow clean exit at end if nothing to do).");
        }
    }
}

function main() {

  if (runHealthcheck()) {
      console.log("Healthcheck already passing before repair. Exiting.");
      process.exit(hasDiff() ? 0 : 1);
  }

  console.log("Starting repair pipeline...");

  // Step 1: Install
  run('npm ci');
  evaluateAndExitIfFixed();

  // Step 2: Lint/Format
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.scripts && pkg.scripts.format) {
      run('npm run format');
      evaluateAndExitIfFixed();
  }

  // Step 3: Snapshots
  if (pkg.devDependencies && pkg.devDependencies.vitest) {
      run('npx vitest run -u');
      evaluateAndExitIfFixed();
  }

  // Step 4: Type stubs
  run('npx --yes typesync');
  run('npm ci');
  evaluateAndExitIfFixed();

  // Step 5: Lockfile
  run('npm update');
  evaluateAndExitIfFixed();

  // Step 6: Assets
  if (pkg.scripts && pkg.scripts.docs) {
     run('npm run docs');
     evaluateAndExitIfFixed();
  }

  if (runHealthcheck()) {
      if (hasDiff()) {
          console.log("Repairs completed successfully.");
          process.exit(0);
      }
  }

  console.log("Failed to self-heal.");
  process.exit(1);
}

main();

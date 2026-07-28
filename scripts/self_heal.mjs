#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

function run(command, silent = false) {
  try {
    const output = execSync(command, { stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: output ? output.toString() : '' };
  } catch (err) {
    if (!silent) {
      console.error(`Error running command: ${command}`);
    }
    return { success: false, output: err.stdout ? err.stdout.toString() : '' };
  }
}

function runHealthcheck() {
    return run('./scripts/healthcheck.mjs').success;
}

function checkDiff() {
    const diffResult = run('git status --porcelain', true);
    return diffResult.success && diffResult.output.trim().length > 0;
}

function exitIfPassAndDiff() {
    const passed = runHealthcheck();
    const hasDiff = checkDiff();
    if (passed && hasDiff) {
        console.log("Healthcheck passed and meaningul diff found. Self-heal successful.");
        process.exit(0);
    }
}

function main() {
    console.log("Starting self-healing pipeline...");

    // Initial check - if it passes and there's no diff, it shouldn't have been called really, but we can just exit 1 to not open a PR
    if (runHealthcheck() && !checkDiff()) {
        console.log("Healthcheck already passes and there is no diff. Nothing to do.");
        process.exit(1);
    }

    // Step 1: Rebuild/reinstall
    console.log("Step 1: Rebuild/reinstall deps");
    run('npm ci');
    exitIfPassAndDiff();

    // Step 2: Lint/format auto-fix
    console.log("Step 2: Lint/format auto-fix");
    run('npx eslint --fix .');
    run('npx prettier -w .');
    exitIfPassAndDiff();

    // Step 3: Snapshot/generated updates
    console.log("Step 3: Update snapshots");
    run('npx vitest run -u');
    exitIfPassAndDiff();

    // Step 4: Type stubs/analyzer config
    console.log("Step 4: Type stubs");
    run('npx --yes typesync');
    run('npm install'); // install any types added
    exitIfPassAndDiff();

    // Step 5: Dependency re-resolve
    console.log("Step 5: Dependency re-resolve");
    run('npm update');
    exitIfPassAndDiff();

    // Step 6: Static asset regeneration
    // In this project, we run build which is basically static asset generation via tsc
    console.log("Step 6: Static asset regeneration");
    run('npm run build');
    exitIfPassAndDiff();

    console.log("Self-heal pipeline finished. Either healthcheck still fails or there is no diff.");
    process.exit(1);
}

main();

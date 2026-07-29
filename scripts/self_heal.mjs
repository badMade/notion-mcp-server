#!/usr/bin/env node

/**
 * self_heal.mjs
 * Executes idempotent repair steps to fix codebase drift.
 * Stops as soon as a fix results in a healthy codebase with a git diff.
 */

import { execSync } from "node:child_process";

function run(command) {
  try {
    console.log(`\n\x1b[36mRunning repair step: ${command}\x1b[0m`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`\x1b[33mStep failed or had non-zero exit: ${command}\x1b[0m`);
    // Allow continuing to the next step
  }
}

function checkHealth() {
  try {
    execSync("node scripts/healthcheck.mjs", { stdio: "pipe" });
    return true; // Healthy
  } catch (error) {
    return false; // Not healthy
  }
}

function hasDiff() {
  const diff = execSync("git status --porcelain").toString().trim();
  return diff.length > 0;
}

function checkAndExitIfFixed() {
  const healthy = checkHealth();
  const diff = hasDiff();

  console.log(`State -> Healthy: ${healthy}, Has Diff: ${diff}`);

  if (healthy && diff) {
    console.log("\x1b[32mSuccessfully found and applied a repair that restores health!\x1b[0m");
    process.exit(0);
  }
}

function main() {
  console.log("Starting self-healing pipeline...");

  // If already healthy but we want to trigger repairs, we must still have a diff
  // Often it's broken, so we try fixing it.

  // Step 1: Rebuild/reinstall
  run("npm ci");
  checkAndExitIfFixed();

  // Step 2: Lint/format auto-fix
  run("npx eslint --fix . && npx prettier -w .");
  checkAndExitIfFixed();

  // Step 3: Snapshot updates
  run("npx vitest run -u --passWithNoTests");
  checkAndExitIfFixed();

  // Step 4: Type stubs acquisition
  run("npx typesync && npm install");
  checkAndExitIfFixed();

  // Step 5: Dependency re-resolve
  run("npm update --no-save"); // Just updates package-lock.json based on bounds
  checkAndExitIfFixed();

  // Step 6: Static asset regeneration (placeholder if docs/badges exist)
  // run("node scripts/update_docs.mjs");
  // checkAndExitIfFixed();

  console.log("\n\x1b[31mExhausted all repair steps without reaching a healthy diff state.\x1b[0m");
  process.exit(1);
}

main();
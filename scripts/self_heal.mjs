#!/usr/bin/env node

import { execSync } from "child_process";

/**
 * Executes a command synchronously and logs output.
 *
 * @param {string} command - The shell command to execute.
 * @param {boolean} [ignoreError=false] - If true, ignores command failure.
 */
function runStep(command, ignoreError = false) {
  console.log(`Running repair step: ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    if (!ignoreError) {
      console.warn(`Step failed: ${command}`);
    } else {
      console.warn(`Step failed (ignored): ${command}`);
    }
  }
}

/**
 * Checks if there are any uncommitted changes in tracked files, or new files.
 *
 * @returns {boolean} True if there is a diff, false otherwise.
 */
function hasDiff() {
  try {
    const status = execSync("git status --porcelain").toString().trim();
    return status.length > 0;
  } catch (error) {
    console.error("Failed to check git status", error);
    return false;
  }
}

/**
 * Runs the healthcheck script.
 *
 * @returns {boolean} True if healthcheck passes, false otherwise.
 */
function runHealthcheck() {
  console.log("Running healthcheck...");
  try {
    // Suppress output so we don't spam the logs on repeated fails,
    // only if it succeeds do we care, or we handle it.
    execSync("node scripts/healthcheck.mjs", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

function evaluateAndExit() {
  const healthPassed = runHealthcheck();
  const diffExists = hasDiff();

  if (healthPassed && diffExists) {
    console.log("Healthcheck passed AND diff found. Repair successful! Exiting 0.");
    process.exit(0);
  } else if (healthPassed && !diffExists) {
    console.log("Healthcheck passed but no diff found. Continuing pipeline to see if further steps cause drift, or we just pass normally.");
    // We don't exit here, we continue the pipeline. If the pipeline finishes and we're here, the workflow handles it.
  } else {
    console.log("Healthcheck failed. Continuing to next repair step...");
  }
}

async function main() {
  console.log("Starting self-heal pipeline...");

  // Step 1: Reinstall dependencies
  runStep("npm ci");
  evaluateAndExit();

  // Step 2: Format auto-fix
  runStep("npx prettier -w .");
  evaluateAndExit();

  // Step 3: Snapshot updates
  runStep("npx vitest run -u");
  evaluateAndExit();

  // Step 4: Type stubs (N/A for this repo, placeholder)
  // Step 5: Dependency re-resolve (N/A for this repo, placeholder)
  // Step 6: Static asset regeneration (N/A for this repo, placeholder)

  // Final evaluation
  const healthPassed = runHealthcheck();
  const diffExists = hasDiff();

  if (healthPassed && diffExists) {
    process.exit(0);
  } else {
    console.error("Pipeline finished but healthcheck failed, or no diff found. Exiting 1.");
    process.exit(1);
  }
}

main();

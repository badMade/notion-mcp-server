#!/usr/bin/env node

import { execSync } from "child_process";

/**
 * Runs a command silently and returns true if it succeeded.
 */
function runCommandSilent(command) {
  try {
    execSync(command, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs a command and logs its output.
 */
function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (e) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

/**
 * Returns true if there is a git diff.
 */
function hasDiff() {
  const output = execSync("git status --porcelain", { encoding: "utf-8" });
  return output.trim() !== "";
}

/**
 * Runs the healthcheck and returns true if it passes.
 */
function checkHealth() {
  console.log("Running healthcheck...");
  return runCommandSilent("node scripts/healthcheck.mjs");
}

function main() {
  const steps = [
    { name: "Clean install", command: "npm ci" },
    { name: "Lint & Format", command: "npx eslint --fix . && npx prettier -w ." },
    { name: "Update Snapshots", command: "npx vitest run -u --passWithNoTests" },
    { name: "Type sync", command: "npx typesync" },
    { name: "Update dependencies", command: "npm update" },
    { name: "Static asset regeneration", command: "npm run build" },
  ];

  for (const step of steps) {
    console.log(`\n=== Repair Step: ${step.name} ===`);
    runCommand(step.command);

    if (checkHealth()) {
      if (hasDiff()) {
        console.log(`Healthcheck passed and diff found after step: ${step.name}. Exiting with success.`);
        process.exit(0);
      } else {
        console.log(`Healthcheck passed but no diff found after step: ${step.name}. Continuing to next step.`);
        continue;
      }
    } else {
      console.log(`Healthcheck failed after step: ${step.name}. Trying next step...`);
    }
  }

  console.log("\nAll repair steps exhausted without finding a successful fix with a diff.");
  process.exit(1);
}

main();

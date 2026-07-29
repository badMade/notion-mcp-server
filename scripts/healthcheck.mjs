#!/usr/bin/env node

import { execSync } from "child_process";

/**
 * Executes a shell command and throws if it fails.
 */
function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log("Starting healthcheck...");

  // Build the project
  runCommand("npm run build");

  // Run tests (with passWithNoTests flag if Vitest is used)
  runCommand("npx vitest run --passWithNoTests");

  // Lint the project
  runCommand("npx eslint .");

  console.log("Healthcheck passed.");
}

main();

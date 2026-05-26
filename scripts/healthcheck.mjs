#!/usr/bin/env node

/**
 * healthcheck.mjs
 * Validates the codebase health (linting, tests, build).
 * Exits with 0 if healthy, 1 if any check fails.
 */

import { execSync } from "node:child_process";

function run(command) {
  try {
    console.log(`\n\x1b[36mRunning: ${command}\x1b[0m`);
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`\x1b[31mFailed: ${command}\x1b[0m`);
    return false;
  }
}

function main() {
  console.log("Starting healthcheck...");

  const checks = [
    "npx eslint .",                 // Linting
    "npm run build",                // Build / TypeScript check
    "npx vitest run --passWithNoTests" // Testing
  ];

  let isHealthy = true;

  for (const check of checks) {
    if (!run(check)) {
      isHealthy = false;
      break; // Fail fast
    }
  }

  if (isHealthy) {
    console.log("\n\x1b[32mHealthcheck passed!\x1b[0m");
    process.exit(0);
  } else {
    console.error("\n\x1b[31mHealthcheck failed!\x1b[0m");
    process.exit(1);
  }
}

main();
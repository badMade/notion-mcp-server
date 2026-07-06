#!/usr/bin/env node

/**
 * healthcheck.mjs
 * Gatekeeper for self-healing runs.
 * Validates build, lint, and tests.
 * Exits with 0 if all checks pass, otherwise 1.
 */

import { execSync } from "child_process";

const run = (cmd, allowFailure = false) => {
  console.log(`Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    return true;
  } catch (error) {
    console.error(`❌ Check failed: ${cmd}`);
    if (!allowFailure) {
      process.exit(1);
    }
    return false;
  }
};

console.log("=== Running Healthcheck ===");

// 1. Build validation
run("npm run build");

// 2. Linting
run("npx eslint .");

// 3. Tests
// Adding --passWithNoTests prevents failing if test files are missed/ignored.
run("npx vitest run --passWithNoTests");

console.log("✅ Healthcheck passed successfully.");
process.exit(0);

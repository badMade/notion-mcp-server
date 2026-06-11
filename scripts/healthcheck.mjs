#!/usr/bin/env node

/**
 * healthcheck.mjs
 *
 * Verifies the health of the project (linting, types, tests, builds).
 * Exits with 0 if healthy, 1 if unhealthy.
 * Silent on success.
 */

import { execSync } from "child_process";

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
};

const checks = [
  "npx tsc --noEmit",
  "npx eslint \"src/**/*.ts\" \"scripts/**/*.ts\"",
  "npx vitest run --passWithNoTests",
  "npm run build"
];

for (const check of checks) {
  if (!run(check)) {
    process.exit(1);
  }
}

process.exit(0);

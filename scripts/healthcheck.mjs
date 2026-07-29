#!/usr/bin/env node

import { execSync } from "child_process";

const run = (cmd, allowFailure = false) => {
  console.log(`\n=== Running: ${cmd} ===`);
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (err) {
    console.error(`\n❌ Failed: ${cmd}`);
    if (!allowFailure) {
      process.exit(1);
    }
    return false;
  }
};

const main = () => {
  console.log("Starting Healthcheck...");

  // 1. Lint
  run("npx eslint .");

  // 2. Types
  run("npx tsc --noEmit");

  // 3. Tests
  run(
    "npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'"
  );

  // 4. Build
  run("npm run build");

  console.log("\n✅ Healthcheck passed.");
  process.exit(0);
};

main();

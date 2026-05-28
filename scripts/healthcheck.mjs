#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command) {
  try {
    console.log(`\n> Running: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`, error);
    process.exit(1);
  }
}

console.log("🏥 Starting Healthcheck...");

run("npm run build");
run("npx tsc --build");
run("npx eslint .");
run("npx vitest run --passWithNoTests");

console.log("\n✅ Healthcheck passed!");
process.exit(0);

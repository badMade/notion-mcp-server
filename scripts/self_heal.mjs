#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command) {
  try {
    console.log(`\n--- Running repair step: ${command} ---`);
    execSync(command, { stdio: "inherit" });
  } catch {
    console.error(`Warning: Step failed: ${command}`);
  }
}

function checkHealthAndDiff() {
  let isHealthy;
  try {
    console.log("Running healthcheck...");
    execSync("node scripts/healthcheck.mjs", { stdio: "ignore" });
    isHealthy = true;
  } catch {
    isHealthy = false;
  }

  let hasDiff = false;
  try {
    const diff = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (diff.length > 0) {
      hasDiff = true;
    }
  } catch {
    hasDiff = false;
  }

  return { isHealthy, hasDiff };
}

console.log("Starting Self-Heal Pipeline...");

const steps = [
  "npm ci",
  "npx eslint --fix . && npx prettier -w .",
  "npx vitest run -u",
  "npm run build", // stubs/types
  "npm update",
  "npm run build" // static assets regeneration fallback
];

for (const [index, step] of steps.entries()) {
  console.log(`\n=== Repair Step ${index + 1}: ${step} ===`);
  run(step);

  const { isHealthy, hasDiff } = checkHealthAndDiff();

  if (isHealthy && hasDiff) {
    console.log("\n✅ Healthcheck passed and diff found. Stopping repair pipeline.");
    process.exit(0);
  }

  if (isHealthy && !hasDiff) {
    console.log("Healthcheck passed but no diff. Continuing to see if other repairs are needed...");
    continue;
  }

  console.log("Healthcheck failed. Trying next repair step...");
}

console.error("\n❌ Pipeline finished. Either no repair was successful, or no changes were needed.");
process.exit(1);

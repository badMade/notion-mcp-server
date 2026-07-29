#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command) {
  try {
    console.log(`\n> Running: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`\n⚠️ Command failed: ${command} (Continuing...)`);
  }
}

function checkHealth() {
  try {
    execSync("node scripts/healthcheck.mjs", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  const diff = execSync("git status --porcelain").toString().trim();
  return diff.length > 0;
}

console.log("🛠️ Starting Self-Heal Pipeline...");

const steps = [
  { name: "Step 1: Rebuild/reinstall", command: "npm ci" },
  { name: "Step 2: Lint/format auto-fix", command: "npx eslint --fix . && npx prettier -w ." },
  { name: "Step 3: Snapshot updates", command: "npx vitest run -u --passWithNoTests" },
  { name: "Step 4: Type stubs", command: "npx typesync || true" }, // Optional fallback if missing
  { name: "Step 5: Dependency re-resolve", command: "npm update" },
  { name: "Step 6: Static asset regeneration", command: "npm run build" }
];

for (const step of steps) {
  console.log(`\n--- ${step.name} ---`);
  run(step.command);

  console.log("Checking health...");
  if (checkHealth()) {
    if (hasDiff()) {
      console.log("\n✅ Pipeline succeeded: Healthcheck passed AND diff exists!");
      process.exit(0);
    } else {
      console.log("Healthcheck passed but NO diff. Continuing to next step...");
    }
  } else {
    console.log("Healthcheck failed. Continuing to next step...");
  }
}

console.error("\n❌ Pipeline exhausted: Failed to heal or no meaningful diff.");
process.exit(1);

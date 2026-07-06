#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * Idempotent repair script. Runs 6 steps sequentially.
 * After each step, runs the healthcheck.
 * If healthcheck passes AND there is a diff, exits 0 (success, create PR).
 * If healthcheck passes and NO diff, continues to next step.
 * If healthcheck fails, continues to next step.
 * At the end, if nothing fixed the issue and generated a diff, exits 1.
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const healthcheckScript = join(__dirname, "healthcheck.mjs");

function runCommand(cmd) {
  console.log(`\n> Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
  } catch (error) {
    console.error(`  [WARN] Step failed: ${cmd}`);
  }
}

function hasDiff() {
  try {
    const diff = execSync("git status --porcelain", {
      encoding: "utf8",
    }).trim();
    return diff.length > 0;
  } catch (err) {
    return false;
  }
}

function runHealthcheck() {
  console.log(`\n> Running Healthcheck...`);
  try {
    execSync(`node ${healthcheckScript}`, { stdio: "ignore" });
    return true; // Healthcheck passed
  } catch (err) {
    return false; // Healthcheck failed
  }
}

function verifyAndExitIfFixed() {
  const isHealthy = runHealthcheck();
  if (isHealthy) {
    if (hasDiff()) {
      console.log(
        "\n✅ Success! The project is healthy and there are changes to commit.",
      );
      process.exit(0);
    } else {
      console.log(
        "\n✅ Healthcheck passed, but no changes were made. Continuing...",
      );
    }
  } else {
    console.log("\n❌ Healthcheck failed after step. Continuing...");
  }
}

console.log("=== Starting Self-Healing Pipeline ===");

// Check initial state
console.log("\n[0] Initial Check");
verifyAndExitIfFixed();

const steps = [
  {
    name: "Step 1: Rebuild/reinstall (clean install of tooling + deps)",
    cmd: "npm ci",
  },
  {
    name: "Step 2: Lint/format auto-fix",
    cmd: "npx eslint --fix . && npx prettier -w .",
  },
  {
    name: "Step 3: Snapshot regeneration",
    cmd: "npx vitest run -u --passWithNoTests",
  },
  {
    name: "Step 4: Type stubs/analyzer config",
    cmd: "npx typesync",
  },
  {
    name: "Step 5: Dependency re-resolve",
    cmd: "npm update",
  },
  {
    name: "Step 6: Static asset regeneration",
    cmd: "npm run build",
  },
];

for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  runCommand(step.cmd);
  verifyAndExitIfFixed();
}

console.log(
  "\n❌ Self-healing pipeline completed but could not find a fix that passes healthcheck.",
);
process.exit(1);

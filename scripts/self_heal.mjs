#!/usr/bin/env node

import { execSync } from "child_process";
import { writeFileSync, appendFileSync } from "fs";

const LOG_FILE = "repair.log";

const log = (msg) => {
  console.log(msg);
  appendFileSync(LOG_FILE, msg + "\n");
};

const run = (cmd) => {
  log(`\n> ${cmd}`);
  try {
    const output = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    appendFileSync(LOG_FILE, output + "\n");
    return true;
  } catch (err) {
    appendFileSync(LOG_FILE, `Error executing ${cmd}:\n${err.message}\n${err.stdout}\n${err.stderr}\n`);
    log(`❌ Failed: ${cmd}`);
    return false;
  }
};

const hasDiff = () => {
  try {
    const output = execSync("git status --porcelain", { stdio: "pipe", encoding: "utf8" });
    return output.trim().length > 0;
  } catch {
    return false;
  }
};

const runHealthCheck = () => {
  log("\nRunning healthcheck...");
  try {
    execSync("node scripts/healthcheck.mjs", { stdio: "pipe", encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
};

const main = () => {
  writeFileSync(LOG_FILE, "Starting Self-Heal Repair Log...\n");
  log("Starting Self-Healing Pipeline");

  // Step 1: Rebuild/reinstall
  log("\n=== Step 1: Rebuild & Reinstall ===");
  run("npm ci");
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Rebuild & Reinstall.");
      process.exit(0);
    }
  }

  // Step 2: Lint/format auto-fix
  log("\n=== Step 2: Lint/format auto-fix ===");
  run("npx eslint --fix .");
  run("npx prettier -w .");
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Lint/Format auto-fix.");
      process.exit(0);
    }
  }

  // Step 3: Snapshot/generated updates
  log("\n=== Step 3: Snapshot/generated updates ===");
  run("npx vitest run -u --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'");
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Snapshot update.");
      process.exit(0);
    }
  }

  // Step 4: Type stubs/analyzer config
  log("\n=== Step 4: Type stubs/analyzer config ===");
  run("npx typesync || true");
  run("npm install"); // Install the newly added types
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Type stubs sync.");
      process.exit(0);
    }
  }

  // Step 5: Dependency re-resolve
  log("\n=== Step 5: Dependency re-resolve ===");
  run("npm update");
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Dependency update.");
      process.exit(0);
    }
  }

  // Step 6: Static asset regeneration
  log("\n=== Step 6: Static asset regeneration ===");
  // Not applicable specifically for this repo, but here as per universal order
  run("npm run build");
  if (runHealthCheck()) {
    if (hasDiff()) {
      log("\n✅ Healthcheck passed and diff found after Static asset regeneration.");
      process.exit(0);
    }
  }

  log("\n❌ All repair steps exhausted. No fix + diff found.");
  process.exit(1);
};

main();

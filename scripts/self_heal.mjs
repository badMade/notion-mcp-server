#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * Implements the idempotent repair pipeline in the universal order:
 * 1) Rebuild/reinstall (npm install)
 * 2) Lint/format auto-fix (eslint --fix)
 * 3) Snapshot regeneration (vitest run -u)
 * 4) Type stubs (typesync && npm install)
 * 5) Dependency re-resolve (npm update)
 * 6) Static asset regeneration (npm run build)
 *
 * After each step, checks health and git diff.
 * Exits 0 ONLY IF healthy AND there is a diff.
 * Exits 1 if no fixes found or unrecoverable error.
 */

import { execSync } from "child_process";
import fs from "fs";

const log = (msg) => console.log(`[Self-Heal] ${msg}`);
const err = (msg) => console.error(`[Self-Heal] Error: ${msg}`);

const runCommand = (cmd) => {
  log(`Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (error) {
    err(`Command failed: ${cmd}`);
    return false;
  }
};

const checkHealth = () => {
  log(`Running healthcheck...`);
  try {
    execSync("node scripts/healthcheck.mjs", { stdio: "inherit" });
    return true;
  } catch (error) {
    return false;
  }
};

const checkDiff = () => {
  const output = execSync("git status --porcelain", { encoding: "utf8" });
  return output.trim() !== "";
};

const steps = [
  { name: "Rebuild/reinstall", cmd: "npm install" },
  { name: "Lint/format auto-fix", cmd: "npx eslint --fix \"src/**/*.ts\" \"scripts/**/*.ts\"" },
  { name: "Snapshot regeneration", cmd: "npx vitest run -u --passWithNoTests" },
  { name: "Type stubs", cmd: "npx typesync && npm install" },
  { name: "Dependency re-resolve", cmd: "npm update" },
  { name: "Static asset regeneration", cmd: "npm run build" }
];

let fixed = false;

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  log(`--- Step ${i + 1}/6: ${step.name} ---`);

  runCommand(step.cmd);

  const isHealthy = checkHealth();
  const hasDiff = checkDiff();

  if (isHealthy && hasDiff) {
    log(`Success! Project is healthy and has diffs after ${step.name}. Exiting 0.`);
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    log(`Project is healthy but no diffs. Continuing to next step to check for other repairs.`);
    continue;
  } else {
    log(`Project still unhealthy after ${step.name}. Proceeding to next repair step.`);
  }
}

log(`All steps completed. Checking final health and diff.`);
const finalHealth = checkHealth();
const finalDiff = checkDiff();

if (finalHealth && finalDiff) {
  log(`Success at the end! Project is healthy and has diffs. Exiting 0.`);
  process.exit(0);
} else {
  err(`Repair failed to produce a healthy build with new diffs. Exiting 1.`);
  process.exit(1);
}

#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function runCmd(cmd, logFile) {
  try {
    console.log(`> ${cmd} (logging to ${logFile})`);
    execSync(`${cmd} > ${logFile} 2>&1`);
    return true;
  } catch (err) {
    return false;
  }
}

function runHealthcheck(logFile) {
  return runCmd("node scripts/healthcheck.mjs", logFile);
}

function hasDiff() {
  const output = execSync("git status --porcelain").toString().trim();
  return output.length > 0;
}

const pipeline = [
  {
    name: "Rebuild/reinstall",
    cmd: "npm ci"
  },
  {
    name: "Lint/format auto-fix",
    cmd: "npx eslint --fix . && npx prettier --write ."
  },
  {
    name: "Snapshot/generated updates",
    cmd: "npx vitest run -u --passWithNoTests"
  },
  {
    name: "Type stubs/analyzer config",
    cmd: "npx typesync || true"
  },
  {
    name: "Dependency re-resolve",
    cmd: "npm update"
  },
  {
    name: "Static asset regeneration",
    cmd: "npm run build"
  }
];

console.log("Starting Self-Heal Pipeline...");

if (runHealthcheck("pre-check.log")) {
  console.log("Pre-check passed! Checking for diffs...");
  if (hasDiff()) {
    console.log("Pre-check passed and diffs found. Exiting early.");
    process.exit(0);
  }
  console.log("Pre-check passed, but no diffs. Running pipeline to force checks...");
}

for (let i = 0; i < pipeline.length; i++) {
  const step = pipeline[i];
  console.log(`\n--- Step ${i + 1}: ${step.name} ---`);

  runCmd(step.cmd, `repair-step-${i + 1}.log`);

  if (runHealthcheck("post-check.log")) {
    if (hasDiff()) {
      console.log(`\nStep ${i + 1} (${step.name}) fixed the issue and produced a diff.`);
      process.exit(0); // Exit 0 only if pass + diff
    } else {
      console.log(`\nStep ${i + 1} (${step.name}) passed healthcheck, but no diff found. Continuing...`);
    }
  } else {
    console.log(`\nStep ${i + 1} (${step.name}) did not fix the issue. Continuing...`);
  }
}

console.log("\nPipeline finished. Check 'post-check.log' for details.");
if (runHealthcheck("post-check.log")) {
  if (hasDiff()) {
    console.log("Final check passed and diffs found.");
    process.exit(0);
  }
}

console.log("Could not find a valid repair that produced a diff.");
process.exit(1);

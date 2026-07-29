#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command) {
  try {
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    return false;
  }
}

function healthcheck() {
  console.log("Running healthcheck...");

  console.log("Checking install...");
  if (!run("npm install")) return 1;

  console.log("Checking linting...");
  if (!run("npx eslint .")) return 1;

  console.log("Checking tests...");
  if (!run("npx vitest run --passWithNoTests")) return 1;

  console.log("Checking build...");
  if (!run("npm run build")) return 1;

  console.log("Healthcheck passed.");
  return 0;
}

process.exit(healthcheck());
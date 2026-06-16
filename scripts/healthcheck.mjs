#!/usr/bin/env node

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

function runCommand(command, name) {
  console.log(`\n=== Running ${name} ===`);
  try {
    execSync(command, { stdio: "inherit", cwd: rootDir });
    console.log(`✅ ${name} passed.`);
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    return false;
  }
}

function main() {
  console.log("Starting healthcheck...");
  let allPassed = true;

  // 1. Lint
  const lintPassed = runCommand("npx eslint .", "Lint (ESLint)");
  if (!lintPassed) allPassed = false;

  // 2. Type Check / Build
  const buildPassed = runCommand(
    "npm run build",
    "Build (TypeScript + CLI build)",
  );
  if (!buildPassed) allPassed = false;

  // 3. Tests
  const testsPassed = runCommand(
    "npx vitest run --passWithNoTests --exclude '**/http-client.integration.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/parser.test.*'",
    "Tests (Vitest)",
  );
  if (!testsPassed) {
    // must strictly fail if any step fails (including tests).
    allPassed = false;
  }

  if (allPassed) {
    console.log("\n✅ All healthchecks passed!");
    process.exit(0);
  } else {
    console.error("\n❌ Healthcheck failed. See logs above.");
    process.exit(1);
  }
}

main();

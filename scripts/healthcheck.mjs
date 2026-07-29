#!/usr/bin/env node

import { execSync } from "child_process";

/**
 * Executes a command synchronously and returns whether it succeeded.
 *
 * @param {string} command - The shell command to execute.
 * @returns {boolean} True if the command exited with 0, false otherwise.
 */
function runCommand(command) {
  try {
    // Only output if there's an error to keep it silent on success.
    execSync(command, { stdio: "ignore" });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

async function main() {
  let allPassed = true;

  // Type check / Build
  if (!runCommand("npm run build")) {
    allPassed = false;
  }

  // Tests
  if (!runCommand("npx vitest run")) {
    allPassed = false;
  }

  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();

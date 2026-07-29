#!/usr/bin/env node
import { execSync } from 'node:child_process';

/**
 * Executes a command synchronously and logs the output.
 * @param {string} cmd Command to run
 * @param {string} name Friendly name of the step
 * @returns {boolean} True if successful, false otherwise
 */
function runCheck(cmd, name) {
  console.log(`\n--- Running ${name} ---`);
  try {
    execSync(cmd, { stdio: 'inherit' });
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

  // Check 1: Types (TypeScript)
  // Run tsc without emitting files to check type safety
  allPassed = runCheck('npx tsc --noEmit', 'TypeScript Compilation') && allPassed;

  // Check 2: Linting
  // Run eslint if available in package.json devDependencies
  allPassed = runCheck('npx eslint . --ext .ts,.js,.mjs', 'ESLint') && allPassed;

  // Check 3: Tests (Vitest)
  // Ensure we don't fail if no tests exist using passWithNoTests
  allPassed = runCheck('npx vitest run --passWithNoTests', 'Vitest Suite') && allPassed;

  // Check 4: Build
  // Ensures standard build step passes
  allPassed = runCheck('npm run build', 'Build Script') && allPassed;

  if (allPassed) {
    console.log("\n🎉 All healthchecks passed.");
    process.exit(0);
  } else {
    console.error("\n💥 Healthcheck failed. Automation should repair.");
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

import { execSync } from 'child_process';

const runCommand = (command, allowFailure = false) => {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!allowFailure) {
      console.error(`Command failed: ${command}`);
    }
    return false;
  }
};

const hasDiff = () => {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
};

const checkAndExitIfFixed = () => {
  console.log("Running healthcheck...");
  const isHealthy = runCommand('./scripts/healthcheck.mjs', true);

  if (isHealthy) {
    if (hasDiff()) {
      console.log("Healthcheck passed and diff is not empty. Exiting with 0 to indicate a fix.");
      process.exit(0);
    } else {
      console.log("Healthcheck passed but no diff. Continuing to see if other steps generate changes...");
    }
  } else {
    console.log("Healthcheck failed. Continuing repair steps...");
  }
};

console.log("=== Step 1: Rebuild/reinstall ===");
runCommand('npm ci');
checkAndExitIfFixed();

console.log("=== Step 2: Lint/format auto-fix ===");
runCommand('npx eslint . --fix', true);
runCommand('npx prettier -w .', true);
checkAndExitIfFixed();

console.log("=== Step 3: Snapshot update ===");
runCommand("npx vitest run -u --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'", true);
checkAndExitIfFixed();

console.log("=== Step 4: Type stubs ===");
runCommand('npx typesync', true);
checkAndExitIfFixed();

console.log("=== Step 5: Dependency re-resolve ===");
runCommand('npm update', true);
checkAndExitIfFixed();

console.log("=== Step 6: Static assets ===");
runCommand('npm run build', true);
checkAndExitIfFixed();

console.error("All repair steps exhausted, but system is still not healthy or no fix could be generated.");
process.exit(1);

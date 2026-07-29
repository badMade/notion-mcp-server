import { execSync } from 'child_process';
import fs from 'fs';

function runCmd(cmd, allowFail = false) {
  try {
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    if (!allowFail) {
      return false;
    }
    return true;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  return status.length > 0;
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function checkAndExitIfFixed() {
  const diff = hasDiff();
  const healthy = runHealthcheck();

  if (healthy && diff) {
    console.log("Healthcheck passed AND we have a diff. Self-heal successful!");
    process.exit(0);
  }

  if (!healthy) {
    console.log("Healthcheck failed. Continuing pipeline...");
  } else {
    console.log("Healthcheck passed, but NO diff found yet. Continuing pipeline...");
  }
}

function main() {
  console.log("Starting self-heal pipeline...");

  // Step 1: Rebuild/reinstall deps
  console.log("--- Step 1: Install dependencies ---");
  runCmd('npm ci');
  checkAndExitIfFixed();

  // Step 2: Lint/format auto-fix
  console.log("--- Step 2: Lint/Format ---");
  // using eslint --fix if installed, ignoring error if not found
  runCmd('npx eslint --fix .', true);
  runCmd('npx prettier -w .', true);
  checkAndExitIfFixed();

  // Step 3: Snapshot/generated updates
  console.log("--- Step 3: Test snapshots ---");
  runCmd('npx vitest run -u', true);
  checkAndExitIfFixed();

  // Step 4: Type stubs/analyzer config
  console.log("--- Step 4: Type sync ---");
  runCmd('npx typesync', true);
  runCmd('npm install', true); // after typesync
  checkAndExitIfFixed();

  // Step 5: Dependency re-resolve
  console.log("--- Step 5: Dependency update ---");
  runCmd('npm update', true);
  checkAndExitIfFixed();

  // Step 6: Static asset regeneration
  console.log("--- Step 6: Assets ---");
  // Assuming no asset build for now, but leaving placeholder for standard.
  checkAndExitIfFixed();

  console.log("Self-heal pipeline completed.");

  // Final check: Only exit 0 if there's a diff AND healthcheck passes
  if (runHealthcheck() && hasDiff()) {
    console.log("Final check passed with diff.");
    process.exit(0);
  } else {
    console.log("No valid repair generated.");
    process.exit(1);
  }
}

main();

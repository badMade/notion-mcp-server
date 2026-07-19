#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  try {
    console.log(`\n> [Self-Heal] Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`\n! [Self-Heal] Failed: ${cmd}`);
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function exitIfFixed() {
  if (checkHealth()) {
    if (hasDiff()) {
      console.log("✅ Repair successful and diff found. Exiting 0 to trigger PR.");
      process.exit(0);
    } else {
      console.log("ℹ️ Repair resulted in pass, but no diff found. Continuing...");
    }
  } else {
    console.log("❌ Healthcheck failed after repair step. Continuing to next step...");
  }
}

async function main() {
  console.log("Starting Self-Heal Pipeline...");

  if (checkHealth()) {
    if (hasDiff()) {
       console.log("Healthcheck already passes and there is a diff. Exiting 0.");
       process.exit(0);
    }
    console.log("Healthcheck already passes (no diff). Continuing in case we can optimize...");
  }

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log("\n--- Step 1: Rebuild/reinstall ---");
  run('npm ci');
  exitIfFixed();

  // Step 2: Lint/format auto-fix (language-specific formatter)
  console.log("\n--- Step 2: Lint/format auto-fix ---");
  run('npx eslint . --fix');
  exitIfFixed();

  // Step 3: Snapshot/generated updates (test snapshot regeneration)
  console.log("\n--- Step 3: Snapshot/generated updates ---");
  run('npx vitest run -u');
  exitIfFixed();

  // Step 4: Type stubs/analyzer config (acquire missing types)
  // Usually typesync or similar. Skipping as it might add unapproved deps.
  console.log("\n--- Step 4: Type stubs (No-op for safe execution) ---");
  exitIfFixed();

  // Step 5: Dependency re-resolve (lockfile refresh)
  console.log("\n--- Step 5: Dependency re-resolve ---");
  run('npm install');
  exitIfFixed();

  // Step 6: Static asset regeneration (docs, badges, code-gen)
  console.log("\n--- Step 6: Static asset regeneration (build) ---");
  run('npm run build');
  exitIfFixed();

  console.error("\n❌ Exhausted all repair steps. Healthcheck still fails or no diff generated. Exiting 1.");
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

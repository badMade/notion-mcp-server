#!/usr/bin/env node

/**
 * Self-Heal Repair Script
 *
 * Runs idempotent repair steps:
 * 1. Rebuild/reinstall (npm ci)
 * 2. Lint/format auto-fix (prettier)
 * 3. Snapshot updates (vitest -u)
 * 4. Type stubs (N/A for this TS project out-of-the-box, but placeholder exists)
 * 5. Dependency re-resolve (npm audit fix / dedupe)
 * 6. Static asset regen (build)
 *
 * Exits 0 ONLY IF healthcheck passes AND there is a diff.
 * Exits 1 if healthcheck fails or no diff is produced.
 */

import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const HEALTHCHECK = resolve(__dirname, 'healthcheck.mjs');

function runCmd(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function checkHealth() {
  console.log('\n> Running healthcheck...');
  const res = spawnSync(HEALTHCHECK, [], { cwd: REPO_ROOT, stdio: 'inherit' });
  return res.status === 0;
}

function getDiff() {
  try {
    const diff = execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf-8' });
    return diff.trim();
  } catch (err) {
    return '';
  }
}

function main() {
  console.log("=== Starting Self-Heal Pipeline ===");

  const steps = [
    { name: "Step 1: Reinstall dependencies", cmd: "npm ci" },
    { name: "Step 2: Lint/format auto-fix", cmd: "npx prettier -w ." },
    { name: "Step 3: Snapshot updates", cmd: "npx vitest run -u" },
    { name: "Step 4: Type stubs", cmd: "echo 'No dedicated type stub step needed'" },
    { name: "Step 5: Dependency re-resolve", cmd: "npm dedupe" },
    { name: "Step 6: Asset regen", cmd: "npm run build" }
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    runCmd(step.cmd);

    const isHealthy = checkHealth();
    const diff = getDiff();

    if (isHealthy) {
      if (diff) {
        console.log(`\n[SUCCESS] Healthcheck passed and drift repaired!`);
        console.log(`\nDiff:\n${diff}`);
        process.exit(0);
      } else {
         console.log(`\n[CONTINUE] Healthcheck passed, but no meaningful diff produced. Trying next step...`);
      }
    } else {
      console.log(`\n[CONTINUE] Healthcheck still failing. Trying next step...`);
    }
  }

  // If we exhaust all steps
  const isHealthy = checkHealth();
  const diff = getDiff();

  if (isHealthy && diff) {
     console.log(`\n[SUCCESS] Healthcheck passed and drift repaired after all steps!`);
     process.exit(0);
  } else if (!isHealthy) {
     console.error(`\n[FAIL] Exhausted all repair steps, but healthcheck still fails.`);
     process.exit(1);
  } else {
     console.error(`\n[FAIL] Exhausted all repair steps. System is healthy, but no repairs were made (no diff).`);
     process.exit(1);
  }
}

main();

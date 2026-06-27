#!/usr/bin/env node

/**
 * self_heal.mjs - The idempotent auto-repair pipeline.
 * Runs 6 universal steps to heal code issues.
 * Exits 0 ONLY if there's a git diff at the end AND the healthcheck passes.
 * Otherwise, exits 1.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

function runStep(name, command) {
  console.log(`\n--- Step: ${name} ---`);
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`⚠️  Step '${name}' failed or completed with non-zero status. Proceeding to next step.`);
  }
}

function runHealthcheck() {
  console.log(`\n--- Validating Repair via Healthcheck ---`);
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasGitDiff() {
  const diff = execSync('git status --porcelain', { encoding: 'utf-8' });
  return diff.trim().length > 0;
}

console.log("=== Starting Self-Heal Pipeline ===");

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
runStep('Rebuild/reinstall', 'npm ci');

// Step 2: Lint/format auto-fix
runStep('Lint/format auto-fix', 'npx eslint --fix . && npx prettier -w .');

// Step 3: Snapshot/generated updates
runStep('Snapshot updates', 'npx vitest run -u --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*"');

// Step 4: Type stubs/analyzer config (if applicable for TS)
// If typesync were installed, we would use: `npx typesync`
runStep('Type stubs', 'echo "No type stub regenerator configured"');

// Step 5: Dependency re-resolve (lockfile refresh)
runStep('Dependency re-resolve', 'npm update');

// Step 6: Static asset regeneration
runStep('Static asset regeneration', 'echo "No static assets to regenerate"');

console.log("\n=== Self-Heal Pipeline Completed ===");

const isHealthy = runHealthcheck();
const hasDiff = hasGitDiff();

if (isHealthy && hasDiff) {
  console.log("✅ Repair successful and modifications were made.");
  process.exit(0);
} else {
  if (!isHealthy) {
    console.error("❌ Healthcheck still failing after repair attempts.");
  }
  if (!hasDiff) {
    console.log("ℹ️ No modifications were made by the repair steps.");
  }
  process.exit(1);
}

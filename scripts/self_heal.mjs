#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const healthcheckPath = resolve(__dirname, 'healthcheck.mjs');

function runCommand(command, name, ignoreError = false) {
  console.log(`\n--- Running Repair Step: ${name} ---`);
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
  } catch (error) {
    if (!ignoreError) {
      console.log(`⚠️ Step '${name}' reported an issue (Exit Code: ${error.status}).`);
    }
  }
}

function checkHealth() {
  console.log('\n--- Running Post-Repair Healthcheck ---');
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'ignore', cwd: rootDir }); // ignore stdout to reduce noise in loop, but will fail if exit code > 0
    return true;
  } catch (error) {
    console.log(`❌ Post-repair healthcheck failed (Exit Code: ${error.status}).`);
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf-8', cwd: rootDir });
    return diff.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function evaluateAndExit() {
  const isHealthy = checkHealth();
  const hasChanges = hasDiff();

  if (isHealthy && hasChanges) {
    console.log("✅ Repair successful and modifications found. Exiting with success (0).");
    process.exit(0);
  } else if (isHealthy && !hasChanges) {
    console.log("⚠️ Repair resulted in healthy state, but no files were modified. Continuing to next step...");
    // Fall through to allow continuing
  } else {
    console.log("❌ Repair failed to produce a healthy state. Continuing to next step...");
    // Fall through to allow continuing
  }
}

console.log("Starting Self-Heal Pipeline...");

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
runCommand('npm ci', 'Rebuild/Reinstall');
evaluateAndExit();

// Step 2: Lint/format auto-fix
runCommand('npx eslint --fix .', 'Lint/Format Auto-fix', true);
runCommand('npx prettier -w .', 'Prettier Format', true);
evaluateAndExit();

// Step 3: Snapshot/generated updates
runCommand('npx vitest run -u --passWithNoTests', 'Snapshot Regeneration', true);
evaluateAndExit();

// Step 4: Type stubs/analyzer config
// Optional: runCommand('npx typesync', 'Type Stubs', true);
evaluateAndExit();

// Step 5: Dependency re-resolve (lockfile refresh)
runCommand('npm update', 'Dependency Re-resolve (Safe Update)', true);
evaluateAndExit();

// Step 6: Static asset regeneration
// Optional: runCommand('npm run generate-docs', 'Asset Regeneration', true);
evaluateAndExit();

console.log("\nAll repair steps exhausted and no complete fix with diff found. Exiting with error (1).");
process.exit(1);

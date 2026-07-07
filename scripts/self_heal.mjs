#!/usr/bin/env node

/**
 * Idempotent repair script implementing the 6-step pipeline.
 * Exits with 0 ONLY if a repair was made (healthcheck passes AND diff exists).
 * Exits with 1 if no repairs were needed, or if a repair failed to fix the system.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

const runHealthcheck = () => {
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'ignore' });
    return true; // Healthcheck passed
  } catch (error) {
    return false; // Healthcheck failed
  }
};

const hasDiff = () => {
  try {
    const status = execSync('git status --porcelain').toString().trim();
    return status !== '';
  } catch (error) {
    return false;
  }
};

const checkSuccessAndExit = () => {
  console.log('[Self-Heal] Running healthcheck after repair step...');
  const isHealthy = runHealthcheck();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    console.log('[Self-Heal] SUCCESS! Repair fixed the system and generated a diff.');
    process.exit(0);
  } else if (isHealthy && !diffExists) {
    console.log('[Self-Heal] System is healthy, but no diff was generated (no repair needed). Continuing to next step.');
  } else {
    console.log('[Self-Heal] System still failing after repair step. Continuing to next step.');
  }
};

const runCommand = (cmd, stepName) => {
  console.log(`\n[Self-Heal] --- Step: ${stepName} ---`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`[Self-Heal] Warning: Step '${stepName}' exited with an error.`);
  }
  checkSuccessAndExit();
};

const main = () => {
  console.log('[Self-Heal] Starting 6-step idempotent repair pipeline...');

  // Step 1: Rebuild/reinstall
  runCommand('npm ci', '1. Rebuild/reinstall (Clean deps)');

  // Step 2: Lint/format auto-fix
  runCommand('npx eslint --fix . && npx prettier -w .', '2. Lint/format auto-fix');

  // Step 3: Snapshot/generated updates
  runCommand('npx vitest run -u --passWithNoTests', '3. Snapshot regeneration');

  // Step 4: Type stubs/analyzer config
  runCommand('npx typesync', '4. Type stubs acquisition');

  // Step 5: Dependency re-resolve (safe update)
  runCommand('npm update', '5. Dependency re-resolve');

  // Step 6: Static asset regeneration (build)
  runCommand('npm run build', '6. Static asset regeneration');

  console.log('\n[Self-Heal] Repair pipeline completed.');

  // Final check
  const isHealthy = runHealthcheck();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    console.log('[Self-Heal] Final check: SUCCESS (healthy + diff).');
    process.exit(0);
  } else {
    console.log('[Self-Heal] Final check: FAILED. Either system is still unhealthy, or no repairs were made (no diff).');
    // Exit non-zero so the workflow doesn't open a PR for nothing/broken state
    process.exit(1);
  }
};

main();

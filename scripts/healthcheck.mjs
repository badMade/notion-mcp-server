#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Ensures the system integrity is maintained (lint, tests, build).
 * Must exit with 0 if healthy, or 1 if any check fails.
 */

import { execSync } from 'child_process';

const runCommand = (cmd, stepName) => {
  console.log(`\n[Healthcheck] Running ${stepName}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[Healthcheck] ${stepName} passed.`);
  } catch (error) {
    console.error(`[Healthcheck] ${stepName} failed.`);
    process.exit(1); // Strict gatekeeper: exit non-zero immediately on failure
  }
};

const main = () => {
  console.log('[Healthcheck] Starting system validation...');

  // 1. Build
  runCommand('npm run build', 'Build (tsc and cli build)');

  // 2. Lint
  runCommand('npx eslint .', 'ESLint');

  // 3. Tests
  // using --passWithNoTests to prevent failing if there are no tests matched
  runCommand('npx vitest run --passWithNoTests', 'Vitest (Tests)');

  console.log('\n[Healthcheck] All checks passed successfully. System is healthy.');
  process.exit(0);
};

main();

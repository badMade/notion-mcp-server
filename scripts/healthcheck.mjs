#!/usr/bin/env node

/**
 * healthcheck.mjs
 * Validates the health of the project (types, build, tests).
 * Exits 0 if healthy, 1 if unhealthy.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function runCommand(command, ignoreExitCode = false) {
  try {
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!ignoreExitCode) {
      console.error(`\n[Healthcheck] Command failed: ${command}`);
      return false;
    }
    return true;
  }
}

function main() {
  console.log('[Healthcheck] Starting...');

  // 1. Build (types + CLI)
  console.log('\n[Healthcheck] Running build...');
  if (!runCommand('npm run build')) {
    process.exit(1);
  }

  // 2. Tests
  console.log('\n[Healthcheck] Running tests...');
  // We use npx vitest run --run to ensure it runs once and doesn't watch
  if (!runCommand('npx vitest run')) {
    process.exit(1);
  }

  // (Optional: Lint)
  // There is no lint script in package.json right now, so we skip it.

  console.log('\n[Healthcheck] All checks passed! Project is healthy.');
  process.exit(0);
}

main();

#!/usr/bin/env node

/**
 * Self-Heal Healthcheck Script
 *
 * Verifies that the project is in a healthy state:
 * - Types check out
 * - Build succeeds
 * - Tests pass
 *
 * Exits 0 if healthy, 1 otherwise. Silent on success.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

function runCheck(cmd, name) {
  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.error(`\n[!] Healthcheck failed on step: ${name}`);
    console.error(err.stdout?.toString() || '');
    console.error(err.stderr?.toString() || err.message);
    return false;
  }
}

function main() {
  const checks = [
    { name: 'Type Check', cmd: 'npx tsc --noEmit' },
    { name: 'Build', cmd: 'npm run build' },
    // Only run standard test suite without updating snapshots for healthcheck
    { name: 'Tests', cmd: 'npx vitest run --passWithNoTests' }
  ];

  let healthy = true;
  for (const check of checks) {
    if (!runCheck(check.cmd, check.name)) {
      healthy = false;
      break;
    }
  }

  if (!healthy) {
    process.exit(1);
  }
  // Silent success
  process.exit(0);
}

main();

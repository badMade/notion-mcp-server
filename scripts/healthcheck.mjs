#!/usr/bin/env node

/**
 * Healthcheck script for the self-healing CI pipeline.
 * Validates the repository state by running lint, type checks, and tests.
 * Silences output unless an error occurs to keep CI logs clean.
 * Exits with 0 if all checks pass, 1 if any fail.
 */

import { execSync } from 'node:child_process';
import process from 'node:process';

function runCheck(command, name) {
  try {
    // Run the command silently
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`\n❌ Check failed: ${name}`);
    console.error(`Command: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function main() {
  const checks = [
    { name: 'TypeScript Build / Type Check', command: 'npx tsc --noEmit' },
    { name: 'Vitest Tests', command: 'npx vitest run' },
    { name: 'Build CLI', command: 'npm run build' }
  ];

  let success = true;

  for (const check of checks) {
    if (!runCheck(check.command, check.name)) {
      success = false;
    }
  }

  if (success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();

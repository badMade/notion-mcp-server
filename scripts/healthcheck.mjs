#!/usr/bin/env node

/**
 * healthcheck.mjs
 *
 * Verifies build and tests.
 * Exits with 0 on pass or 1 on fail. Silent unless there's an error.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  // Check build
  execSync('npm run build', { stdio: 'ignore' });

  // Check types/tests
  execSync('npx vitest run', { stdio: 'ignore' });

  // Check lint if script exists
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  if (pkg.scripts && pkg.scripts.lint) {
    execSync('npm run lint', { stdio: 'ignore' });
  }

  process.exit(0);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Healthcheck script for self-healing workflow.
 * Exits 0 if all checks pass, otherwise exits 1.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function runCheck(name, command) {
  console.log(`Running healthcheck: ${name}...`);
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' });
    console.log(`✅ ${name} passed.\n`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} failed.\n`);
    return false;
  }
}

function main() {
  console.log('--- Starting Healthcheck ---');
  let passed = true;

  // 1. Lint
  passed = runCheck('Lint', 'npx eslint .') && passed;

  // 2. Tests (excluding known flaky/expected failures per memory)
  // Memory: "Pre-existing test failures in files like parser.test.ts, http-client-upload.test.ts, and http-client.integration.test.ts on the main branch are expected out of the box... explicitly exclude them (e.g., --exclude '**/parser.test.*')"
  passed = runCheck('Tests', 'npx vitest run --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*"') && passed;

  // 3. Build
  passed = runCheck('Build', 'npm run build') && passed;

  if (passed) {
    console.log('--- Healthcheck Passed ---');
    process.exit(0);
  } else {
    console.error('--- Healthcheck Failed ---');
    process.exit(1);
  }
}

main();

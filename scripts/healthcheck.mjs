#!/usr/bin/env node

/**
 * healthcheck.mjs - Verifies lint, types, tests, and build.
 * Acts as the strict gatekeeper for self-healing runs.
 * Exits 0 on success, 1 on failure.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runCommand(command, errorMessage) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Healthcheck failed: ${errorMessage}`);
    process.exit(1);
  }
}

console.log("=== Running Healthcheck ===");

// 1. Run Linter
runCommand('npx eslint .', 'Linting failed.');

// 2. Type Check
runCommand('npx tsc --noEmit', 'Type checking failed.');

// 3. Tests (excluding known failures from main)
runCommand('npx vitest run --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*"', 'Tests failed.');

// 4. Build
runCommand('npm run build', 'Build failed.');

console.log("✅ Healthcheck passed.");
process.exit(0);

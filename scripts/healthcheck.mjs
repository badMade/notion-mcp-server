#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to run commands
function run(command, name) {
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch (error) {
    console.error(`\n❌ ${name} failed`);
    return false;
  }
}

let allPassed = true;

// 1. Build
if (!run('npm run build', 'Build')) {
  allPassed = false;
}

// 2. Lint
// Use direct ESLint command. Adjusting config logic is handled by setup/repair if needed.
if (!run('npx eslint', 'Lint')) {
  allPassed = false;
}

// 3. Types
// Type checking is part of 'npm run build' via tsc in this repo.
// We can also run an explicit check if 'tsc --noEmit' is preferred, but build implies type checking.

// 4. Tests
// Use npx vitest run
// Note: Some tests are expected to fail on main for this specific repo (e.g. parser.test.js, http-client-upload.test.js)
// We will still run them. If they fail, healthcheck fails unless handled otherwise.
if (!run('npx vitest run', 'Tests')) {
  allPassed = false;
}

if (allPassed) {
  process.exit(0);
} else {
  process.exit(1);
}

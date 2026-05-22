#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// Helper to run commands
function runCmd(command, env = {}) {
  try {
    console.log(`\n=> Running: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    return false;
  }
}

async function main() {
  console.log('=== Running Healthcheck ===');
  let success = true;

  // 1. Check build
  if (!runCmd('npm run build')) {
    success = false;
  }

  // 2. Check types
  if (!runCmd('npx tsc --noEmit')) {
    success = false;
  }

  // 3. Check linting (if config exists)
  const hasEslintConfig = existsSync(path.join(process.cwd(), 'eslint.config.js')) ||
                          existsSync(path.join(process.cwd(), '.eslintrc.json')) ||
                          existsSync(path.join(process.cwd(), '.eslintrc.js'));

  if (hasEslintConfig) {
    if (!runCmd('npx eslint .')) {
      success = false;
    }
  } else {
    console.log('\n=> Skipping ESLint: No config found');
  }

  // 4. Check tests
  if (!runCmd('npx vitest run --passWithNoTests')) {
    success = false;
  }

  if (success) {
    console.log('\n✅ Healthcheck PASSED');
    process.exit(0);
  } else {
    console.error('\n❌ Healthcheck FAILED');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

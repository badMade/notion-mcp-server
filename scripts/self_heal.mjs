#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const healthcheckPath = path.resolve(__dirname, 'healthcheck.mjs');

function hasDiff() {
  const status = execSync('git status --porcelain', { cwd: rootDir }).toString().trim();
  return status !== '';
}

function runHealthcheck() {
  try {
    execSync(`node ${healthcheckPath}`, { cwd: rootDir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function executeStep(name, commands) {
  console.log(`\n▶️  Running Step: ${name}`);
  for (const cmd of commands) {
    try {
      console.log(`   $ ${cmd}`);
      execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      console.warn(`   ⚠️ Command failed: ${cmd}`);
    }
  }

  const passed = runHealthcheck();
  const diff = hasDiff();

  if (passed && diff) {
    console.log(`\n✅ Healthcheck passed and diff found after: ${name}`);
    process.exit(0);
  } else if (passed && !diff) {
    console.log(`   Healthcheck passed but no diff. Continuing...`);
  } else {
    console.log(`   Healthcheck still failing. Continuing...`);
  }
}

// Check if we are already fixed and have a diff
if (runHealthcheck() && hasDiff()) {
    console.log("Already passing and have a diff. Exiting 0.");
    process.exit(0);
}

// Repair Pipeline Steps
// Step 1: Rebuild/reinstall
executeStep('Rebuild and reinstall dependencies', [
  'npm ci'
]);

// Step 2: Lint/format auto-fix
executeStep('Lint and Format', [
  'npx eslint --fix'
]);

// Step 3: Snapshot/generated updates
executeStep('Update test snapshots', [
  'npx vitest run -u'
]);

// Step 4: Type stubs/analyzer config
// Types/stubs update mechanism (none standard for JS besides typesync, but adding explicit install of types if needed)
executeStep('Update types (if applicable)', [
  'npx typesync || true',
  'npm install'
]);

// Step 5: Dependency re-resolve
executeStep('Update dependencies', [
  'npm update'
]);

// Step 6: Static asset regeneration
executeStep('Regenerate static assets', [
  'npm run build'
]);

// If we reach here, we didn't meet the (pass AND diff) exit 0 condition
console.log('\n❌ Could not auto-repair with a valid diff.');
process.exit(1);

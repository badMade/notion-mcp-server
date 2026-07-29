#!/usr/bin/env node

/**
 * Self-healing repair script.
 * Implements the 6 repair steps idempotently:
 * 1) Rebuild/reinstall
 * 2) Lint/format auto-fix
 * 3) Snapshot regeneration
 * 4) Type stubs/analyzer config
 * 5) Dependency re-resolve
 * 6) Static asset regeneration
 *
 * Runs healthcheck after each step. Exits 0 if pass + diff, else continues.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const healthcheckPath = resolve(__dirname, 'healthcheck.mjs');

function runCommand(command, name) {
  console.log(`\n--- Running Repair: ${name} ---`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    console.error(`⚠️ ${name} step had an issue or non-zero exit, continuing...`);
  }
}

function checkHealthAndDiff() {
  console.log('\n--- Running Healthcheck ---');
  let healthPass = false;
  try {
    execSync(`node ${healthcheckPath}`, { cwd: rootDir, stdio: 'inherit' });
    healthPass = true;
  } catch (e) {
    console.log('Healthcheck failed.');
    return false;
  }

  if (healthPass) {
    try {
      const diff = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' }).trim();
      if (diff) {
        console.log('\n✅ Healthcheck passed and diff exists! Repair successful.');
        process.exit(0);
      } else {
        console.log('\nHealthcheck passed, but no diff found. Continuing to next potential repair...');
      }
    } catch (e) {
      console.error('Error checking git status.', e);
    }
  }
  return false;
}

console.log('Starting Self-Healing Pipeline...');

// Step 1: Rebuild/reinstall
runCommand('npm ci', 'Rebuild/Reinstall (npm ci)');
runCommand('npm run build', 'Rebuild/Reinstall (build)');
checkHealthAndDiff();

// Step 2: Lint/format auto-fix
runCommand('npx eslint . --fix && npx prettier -w .', 'Lint/format auto-fix');
checkHealthAndDiff();

// Step 3: Snapshot regeneration
runCommand('npx vitest run -u', 'Snapshot regeneration');
checkHealthAndDiff();

// Step 4: Type stubs/analyzer config (Nothing specific for this node project yet besides tsc, handled in build)
console.log('\n--- Running Repair: Type stubs ---');
console.log('Skipping type stubs (no external type syncer configured)');
checkHealthAndDiff();

// Step 5: Dependency re-resolve
runCommand('npm update', 'Dependency re-resolve');
checkHealthAndDiff();

// Step 6: Static asset regeneration (Skipping since there are no code-gen docs)
console.log('\n--- Running Repair: Static asset regeneration ---');
console.log('Skipping static asset regeneration');
checkHealthAndDiff();

console.log('\n❌ Self-healing pipeline completed without finding a fix that produced a diff.');
process.exit(1);

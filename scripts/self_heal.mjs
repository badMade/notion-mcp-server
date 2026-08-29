#!/usr/bin/env node

/**
 * Self-Heal Repair Script
 * Executes 6 idempotent repair steps.
 * Exits with 0 ONLY if a step passes healthcheck AND produces a git diff.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function runCommand(command, name) {
  console.log(`Running repair step: ${name}...`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`❌ Repair step ${name} failed.`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { cwd: rootDir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  try {
    // Check if there are any changes, ignoring log files
    const status = execSync('git status --porcelain | grep -v "\\.log$" || true', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function main() {
  console.log('Starting self-heal repair sequence...');

  const steps = [
    { name: '1. Rebuild/reinstall', command: 'npm ci --legacy-peer-deps' },
    { name: '2. Lint/format auto-fix', command: 'npx eslint --fix . || true; npx prettier -w . || true' },
    { name: '3. Snapshot updates', command: 'npx vitest run -u || true' },
    { name: '4. Type stubs', command: 'npx typesync || true' },
    { name: '5. Dependency re-resolve', command: 'npm install --legacy-peer-deps' },
    { name: '6. Static asset regeneration', command: 'npm run build || true' }
  ];

  for (const step of steps) {
    runCommand(step.command, step.name);

    if (checkHealth()) {
      if (hasDiff()) {
        console.log(`✅ Step '${step.name}' resolved issues and produced a diff. Exiting with success (0).`);
        process.exit(0);
      } else {
         console.log(`⚠️ Step '${step.name}' passed healthcheck but produced no diff. Continuing...`);
      }
    } else {
        console.log(`❌ Healthcheck failed after step '${step.name}'. Continuing to next step...`);
    }
  }

  console.log('💥 Self-heal exhausted all steps without producing a passing diff.');
  process.exit(1);
}

main();
#!/usr/bin/env node

/**
 * Self-healing repair script
 * Idempotent pipeline:
 * 1. Rebuild/reinstall
 * 2. Lint/format auto-fix
 * 3. Snapshot regeneration
 * 4. Type stubs/analyzer config
 * 5. Dependency re-resolve
 * 6. Static asset regeneration
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Failed: ${command}`);
    return false;
  }
}

function checkDiff() {
  const diff = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf-8' });
  return diff.trim().length > 0;
}

function checkHealth() {
  try {
    execSync(`node ${path.join(__dirname, 'healthcheck.mjs')}`, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log('--- Starting Self-Healing Pipeline ---');

  const steps = [
    { name: '1. Rebuild/reinstall', cmd: 'npm ci && npm run build' },
    { name: '2. Lint/format auto-fix', cmd: 'npx eslint . --fix || true' },
    { name: '3. Snapshot regeneration', cmd: 'npx vitest run -u || true' },
    { name: '4. Type stubs/analyzer config', cmd: 'npm install --package-lock-only || true' }, // Or npx typesync
    { name: '5. Dependency re-resolve', cmd: 'npm update || true' }, // standard npm update over latest
    { name: '6. Static asset regeneration', cmd: 'npm run build || true' } // Placeholder for asset gen
  ];

  for (const step of steps) {
    console.log(`\nExecuting Step: ${step.name}`);
    runCommand(step.cmd);

    const isHealthy = checkHealth();
    const hasDiff = checkDiff();

    if (isHealthy) {
      if (hasDiff) {
        console.log(`✅ Pipeline restored health in step: ${step.name}. Diff detected. Exiting 0.`);
        process.exit(0);
      } else {
        console.log(`⚠️ Pipeline healthy after step: ${step.name}, but no diff detected. Continuing...`);
        // continue
      }
    } else {
        console.log(`❌ Pipeline still unhealthy after step: ${step.name}. Continuing to next step...`);
    }
  }

  // If we reach here, we either didn't fix it, or fixed it but have no diff
  console.error('--- Self-Healing Pipeline Finished Without Resolving Diff ---');
  process.exit(1);
}

main();

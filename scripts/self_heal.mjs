#!/usr/bin/env node

/**
 * Self-healing repair script.
 * Implements a 6-step idempotent repair pipeline to fix drift and CI failures.
 * Steps:
 * 1. Rebuild/reinstall (npm ci)
 * 2. Lint/format auto-fix (prettier)
 * 3. Snapshot updates (vitest run -u)
 * 4. Type stubs (typesync)
 * 5. Dependency re-resolve (npm update)
 * 6. Static asset regeneration (npm run build)
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const steps = [
  { name: 'Rebuild/reinstall', command: 'npm ci' },
  { name: 'Lint/format auto-fix', command: 'npx prettier -w .' },
  { name: 'Snapshot/generated updates', command: 'npx vitest run -u' },
  { name: 'Type stubs/analyzer config', command: 'npx typesync' },
  { name: 'Dependency re-resolve', command: 'npm update' },
  { name: 'Static asset regeneration', command: 'npm run build' }
];

function runCommand(command, name) {
  console.log(`\n⚙️ Running step: ${name}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    console.error(`❌ Step failed: ${name}`);
    return false;
  }
}

function runHealthcheck() {
  console.log(`\n🏥 Running healthcheck...`);
  try {
    const healthcheckPath = path.join(__dirname, 'healthcheck.mjs');
    execSync(`node ${healthcheckPath}`, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    return false;
  }
}

function hasGitDiff() {
  try {
    const output = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8' });
    return output.trim().length > 0;
  } catch (error) {
    console.error('Failed to check git status:', error);
    return false;
  }
}

function main() {
  console.log('🚀 Starting self-healing pipeline...');

  for (const step of steps) {
    runCommand(step.command, step.name);

    // Check if we fixed the issue after each step
    const isHealthy = runHealthcheck();
    const hasDiff = hasGitDiff();

    if (isHealthy && hasDiff) {
      console.log('\n✅ Healthcheck passed AND git diff detected. Repair successful!');
      process.exit(0);
    } else if (isHealthy && !hasDiff) {
        console.log('\n✅ Healthcheck passed but no diff. Continuing in case further optimization is possible...');
    } else {
        console.log('\n❌ Healthcheck still failing. Proceeding to next repair step...');
    }
  }

  // Final evaluation
  const finalHealth = runHealthcheck();
  const finalDiff = hasGitDiff();

  if (finalHealth && finalDiff) {
    console.log('\n✅ Final healthcheck passed AND git diff detected. Repair successful!');
    process.exit(0);
  } else if (!finalHealth) {
    console.error('\n❌ Repair failed. Project is still unhealthy after all steps.');
    process.exit(1);
  } else {
    console.log('\n🤷 Repair completed. Project is healthy, but no changes were necessary (no git diff).');
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

const steps = [
  { name: 'Rebuild/reinstall', cmd: 'npm ci' },
  { name: 'Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Snapshot updates', cmd: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type stubs', cmd: 'npx typesync' },
  { name: 'Dependency re-resolve', cmd: 'npm update' },
  { name: 'Static asset regeneration', cmd: 'echo "No static assets generation step configured"' }
];

function runHealthcheck() {
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'pipe' });
    return true; // Passed
  } catch (error) {
    return false; // Failed
  }
}

function hasDiff() {
  const diff = execSync('git status --porcelain', { encoding: 'utf-8' });
  return diff.trim().length > 0;
}

console.log('Starting self-healing process...');

for (const step of steps) {
  console.log(`\n--- Step: ${step.name} ---`);
  try {
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`Step failed or encountered an error (this might be expected): ${step.name}`);
  }

  const passed = runHealthcheck();
  const diff = hasDiff();

  if (passed && diff) {
    console.log(`Self-healing successful after step: ${step.name}. Changes detected.`);
    process.exit(0);
  } else if (passed && !diff) {
    console.log(`Healthcheck passed but no changes detected. Continuing...`);
    continue;
  } else {
    console.log(`Healthcheck failed after step: ${step.name}. Proceeding to next step.`);
  }
}

console.error('\nSelf-healing process finished but failed to fix the issues, or no diff was produced.');
process.exit(1);

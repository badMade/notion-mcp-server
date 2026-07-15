#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function runHealthCheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  try {
    // Stage everything first to catch all changes
    execSync('git add -A', { stdio: 'pipe' });
    const output = execSync('git status --porcelain', { stdio: 'pipe' }).toString().trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function checkAndExitIfFixed() {
  if (runHealthCheck() && hasDiff()) {
    console.log('Healthcheck passed and diff exists. Repair successful.');
    process.exit(0);
  }
}

// Detect project structure
const targetDir = fs.existsSync('src') ? 'src/' : (fs.existsSync('lib') ? 'lib/' : '.');

const steps = [
  { name: 'Reinstall dependencies', command: 'npm ci' },
  { name: 'Lint and format', command: `npx eslint ${targetDir} --fix && npx prettier -w ${targetDir}` },
  { name: 'Update test snapshots', command: 'npx vitest run -u --passWithNoTests' },
  { name: 'Acquire missing types', command: 'npx typesync' },
  { name: 'Refresh dependencies', command: 'npm update' },
  { name: 'Rebuild project', command: 'npm run build' }
];

console.log('Starting self-healing process...');

for (const step of steps) {
  console.log(`\n--- Step: ${step.name} ---`);
  runCommand(step.command);

  console.log('Running healthcheck...');
  checkAndExitIfFixed();
}

console.log('\nSelf-healing process failed to resolve all issues or produced no changes.');
process.exit(1);

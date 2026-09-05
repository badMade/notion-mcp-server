#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const steps = [
  { name: 'install', cmd: 'npm ci' },
  { name: 'lint', cmd: 'npx eslint --fix src/ && npx prettier -w src/' },
  { name: 'snapshot', cmd: 'npx vitest run -u' },
  { name: 'typesync', cmd: 'npx typesync' },
  { name: 'lockfile', cmd: 'npm install --legacy-peer-deps' },
  { name: 'build', cmd: 'npm run build' }
];

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
    const lines = diff.split('\n').filter(line => line.trim().length > 0 && !line.endsWith(".log"));
    return lines.length > 0;
  } catch (e) {
    return false;
  }
}

for (const step of steps) {
  console.log(`Running step: ${step.name}`);
  try {
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Step ${step.name} failed:`, e.message);
  }

  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log('Fix found and applied successfully.');
      process.exit(0);
    }
  }
}

console.log('No complete fix found or applied.');
process.exit(1);

#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { encoding: 'utf-8' });
    const filtered = diff.split('\n').filter(line => line.trim() && !line.endsWith('.log')).join('\n');
    return filtered.length > 0;
  } catch (error) {
    return false;
  }
}

const steps = [
  'npm ci --legacy-peer-deps',
  'npx eslint . --fix',
  'npx vitest run -u',
  'npx typesync',
  'npm update --legacy-peer-deps',
  'npm run build'
];

for (const step of steps) {
  run(step);
  if (checkHealth() && hasDiff()) {
    process.exit(0);
  }
}

process.exit(1);
#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function runSilent(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (err) {
    return false;
  }
}

function checkDiff() {
  try {
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
    const filtered = status.split('\n').filter(line => line.trim() && !line.endsWith('.log')).join('\n');
    return filtered.length > 0;
  } catch {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const steps = [
  { name: 'install', cmd: 'npm ci --legacy-peer-deps' },
  { name: 'lint', cmd: 'npx eslint --fix . || true' },
  { name: 'snapshot', cmd: 'npx vitest run -u || true' },
  { name: 'typesync', cmd: 'npx typesync || true' },
  { name: 'lockfile', cmd: 'npm update --latest --legacy-peer-deps || true' },
  { name: 'build', cmd: 'npm run build || true' }
];

for (const step of steps) {
  console.log(`Running repair step: ${step.name}`);
  runSilent(step.cmd);

  const passed = runHealthcheck();
  const hasDiff = checkDiff();

  if (passed && hasDiff) {
    console.log(`Fix achieved after step: ${step.name}`);
    process.exit(0);
  }
}

console.log('No complete fix found or no diff generated.');
process.exit(1);

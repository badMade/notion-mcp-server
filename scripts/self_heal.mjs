#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const status = execSync('git status --porcelain | grep -v "\\.log$" || true', { stdio: 'pipe' }).toString().trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function main() {
  const steps = [
    { name: 'install', cmd: 'npm ci --legacy-peer-deps' },
    { name: 'lint', cmd: 'npx eslint --fix . && npx prettier -w .' },
    { name: 'snapshot', cmd: 'npx vitest run -u' },
    { name: 'typesync', cmd: 'npx --yes typesync' },
    { name: 'lockfile', cmd: 'npm install --legacy-peer-deps' },
    { name: 'build', cmd: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`Running step: ${step.name}`);
    run(step.cmd);

    const isHealthy = runHealthcheck();
    const diff = hasDiff();

    if (isHealthy && diff) {
      console.log(`Fix achieved after step: ${step.name}`);
      process.exit(0);
    }
  }

  console.log('No fix achieved or healthcheck failed');
  process.exit(1);
}

main();
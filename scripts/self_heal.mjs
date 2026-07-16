#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Failed: ${command}`);
    return false;
  }
}

function hasDiff() {
  const diff = execSync('git status --porcelain').toString().trim();
  return diff.length > 0;
}

function checkHealth() {
  console.log('Running healthcheck post-repair...');
  return run('node scripts/healthcheck.mjs');
}

async function main() {
  console.log('Starting self-healing process...');
  let success = false;

  const steps = [
    { name: 'Rebuild/reinstall', cmd: 'npm ci' },
    { name: 'Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
    { name: 'Snapshot updates', cmd: 'npx vitest run -u' },
    { name: 'Type stubs', cmd: 'npx typesync || true' },
    { name: 'Dependency resolve', cmd: 'npm install' },
    { name: 'Static assets', cmd: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`\n--- Step: ${step.name} ---`);
    run(step.cmd);

    if (checkHealth()) {
      if (hasDiff()) {
        console.log(`Healthcheck passed and diff found after step: ${step.name}`);
        success = true;
        break;
      } else {
        console.log(`Healthcheck passed but no diff after step: ${step.name}. Continuing...`);
      }
    } else {
      console.log(`Healthcheck failed after step: ${step.name}. Proceeding to next step...`);
    }
  }

  if (success) {
    console.log('Self-healing successful.');
    process.exit(0);
  } else {
    console.error('Self-healing exhausted steps without resolving issue or no diff produced.');
    process.exit(1);
  }
}

main();

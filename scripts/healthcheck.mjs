#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

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

async function main() {
  console.log('Running healthcheck...');

  let success = true;

  if (!run('npm run build')) success = false;

  if (!run('npx eslint .')) success = false;

  if (!run('npx tsc --noEmit')) success = false;

  if (!run('npx vitest run --passWithNoTests')) success = false;

  process.exit(success ? 0 : 1);
}

main().catch(() => process.exit(1));

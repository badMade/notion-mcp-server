#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

let success = true;
if (!run('npx eslint')) success = false;
if (!run('npx tsc --noEmit')) success = false;
if (!run('npx vitest run')) success = false;
if (!run('npm run build')) success = false;

if (!success) {
  process.exit(1);
}
process.exit(0);

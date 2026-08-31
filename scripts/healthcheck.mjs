#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

let success = true;
if (!run('npm run build')) success = false;
if (!run('npx eslint .')) success = false;
if (!run('npx vitest run')) success = false;

if (!success) {
  process.exit(1);
}
process.exit(0);
#!/usr/bin/env node
import { execSync } from 'child_process';

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

let pass = true;
pass = run('npx eslint .') && pass;
pass = run('npm run build') && pass;
pass = run('npx vitest run') && pass;

process.exit(pass ? 0 : 1);

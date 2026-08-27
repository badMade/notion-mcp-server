#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (error) {
    if (error.stdout) console.error(`stdout: ${error.stdout.toString()}`);
    if (error.stderr) console.error(`stderr: ${error.stderr.toString()}`);
    process.exit(1);
  }
}

run('npm run build');
run('npx eslint .');
run('npx tsc --noEmit');
run('npx vitest run');

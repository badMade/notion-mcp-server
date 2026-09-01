#!/usr/bin/env node
import { execSync } from 'child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`Healthcheck failed on command: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

let success = true;
success = success && run('npx eslint .');
success = success && run('npm run build');
success = success && run('npx vitest run');

if (!success) process.exit(1);
process.exit(0);

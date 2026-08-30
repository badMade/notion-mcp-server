#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

function runCheck(name, command) {
  try {
    // stdio: 'pipe' suppresses output on success
    execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (error) {
    console.error(`\n❌ [Healthcheck] ${name} failed:`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    process.exit(1);
  }
}

function main() {
  runCheck('Linting', 'npx eslint .');
  runCheck('Type Checking', 'npx tsc --noEmit');
  runCheck('Testing', 'npx vitest run --passWithNoTests');
  runCheck('Build', 'npm run build');
  process.exit(0);
}

main();

#!/usr/bin/env node
import { execSync } from 'child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

console.log('Running healthcheck...');
const lintPass = run('npx eslint src');
const typePass = run('npx tsc --noEmit');
const testPass = run('npx vitest run');
const buildPass = run('npm run build');

if (lintPass && typePass && testPass && buildPass) {
  console.log('Healthcheck passed.');
  process.exit(0);
} else {
  console.log('Healthcheck failed.');
  process.exit(1);
}

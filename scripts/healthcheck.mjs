import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function main() {
  console.log('Running healthcheck...');

  let success = true;

  console.log('Checking types...');
  if (!run('npx tsc --noEmit')) {
    success = false;
  }

  console.log('Running linter...');
  if (!run('npx eslint .')) {
    success = false;
  }

  console.log('Running tests...');
  // Ensure vitest runs all tests
  if (!run('npx vitest run')) {
    success = false;
  }

  console.log('Building project...');
  if (!run('npm run build')) {
    success = false;
  }

  if (success) {
    console.log('Healthcheck passed!');
    process.exit(0);
  } else {
    console.log('Healthcheck failed!');
    process.exit(1);
  }
}

main();
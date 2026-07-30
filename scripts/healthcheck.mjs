#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running healthcheck...');

function check(command, name) {
  try {
    console.log(`Checking ${name}...`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`${name} check failed.`);
    return false;
  }
}

let ok = true;
ok = check('npx eslint .', 'Lint') && ok;
ok = check('npx tsc --noEmit', 'Types') && ok;
ok = check('npx vitest run', 'Tests') && ok;
ok = check('npm run build', 'Build') && ok;

if (!ok) {
  console.error('Healthcheck failed!');
  process.exit(1);
}

console.log('Healthcheck passed!');
process.exit(0);

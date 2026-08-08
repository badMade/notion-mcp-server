#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Running healthcheck...');
  if (fs.existsSync('package.json')) {
    console.log('Running lint...');
    execSync('npx eslint .', { stdio: 'inherit' });
    console.log('Running type check...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('Running tests...');
    execSync('npx vitest run', { stdio: 'inherit' });
    console.log('Running build...');
    execSync('npm run build', { stdio: 'inherit' });
  }
  console.log('Healthcheck passed.');
  process.exit(0);
} catch (error) {
  console.error('Healthcheck failed.');
  process.exit(1);
}

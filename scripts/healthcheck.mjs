#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running healthcheck...');
try {
  if (!fs.existsSync('package.json')) {
    console.error('No package.json found. Run from project root.');
    process.exit(1);
  }

  console.log('Running build...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Running lint...');
  execSync('npx eslint .', { stdio: 'inherit' });

  console.log('Running tests...');
  execSync('npx vitest run', { stdio: 'inherit' });

  console.log('Healthcheck passed!');
  process.exit(0);
} catch (err) {
  console.error('Healthcheck failed!');
  process.exit(1);
}

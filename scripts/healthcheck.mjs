#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Running healthcheck...');
  if (fs.existsSync('src')) {
    console.log('Checking linting...');
    execSync('npx eslint src/', { stdio: 'inherit' });
  }
  console.log('Checking build...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Checking types...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('Checking tests...');
  execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' });
  console.log('Healthcheck passed.');
  process.exit(0);
} catch (error) {
  console.error('Healthcheck failed.');
  process.exit(1);
}

#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running healthcheck...');
try {
  if (fs.existsSync('package.json')) {
    console.log('Running lint...');
    execSync('npx eslint src/ scripts/', { stdio: 'inherit' });
    console.log('Running types...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('Running tests...');
    execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' });
    console.log('Running build...');
    execSync('npm run build', { stdio: 'inherit' });
  }
  console.log('Healthcheck passed.');
  process.exit(0);
} catch (error) {
  console.error('Healthcheck failed.');
  process.exit(1);
}
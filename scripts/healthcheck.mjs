#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running healthcheck...');
try {
  console.log('Checking build...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Checking lint...');
  execSync('npx eslint .', { stdio: 'inherit' });

  console.log('Checking tests...');
  execSync('npx vitest run', { stdio: 'inherit' });

  console.log('Healthcheck passed.');
  process.exit(0);
} catch (error) {
  console.error('Healthcheck failed.');
  process.exit(1);
}

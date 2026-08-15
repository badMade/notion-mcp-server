#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Running healthcheck...');
  console.log('1. Type Check');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('2. Lint');
  if (fs.existsSync('eslint.config.mjs')) {
      execSync('npx eslint .', { stdio: 'inherit' });
  }
  console.log('3. Tests');
  execSync('npx vitest run', { stdio: 'inherit' });
  console.log('Healthcheck passed!');
  process.exit(0);
} catch (e) {
  console.error('Healthcheck failed!');
  process.exit(1);
}

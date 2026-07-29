#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log("Running healthcheck...");

  if (!fs.existsSync('src') && !fs.existsSync('lib')) {
    console.warn("Neither src/ nor lib/ found, skipping some checks.");
  }

  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.scripts && pkg.scripts.lint) {
      execSync('npm run lint', { stdio: 'inherit' });
    } else {
      execSync('npx eslint .', { stdio: 'inherit' });
    }
  }

  if (fs.existsSync('tsconfig.json')) {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
  }

  if (fs.existsSync('package.json')) {
    execSync('npx vitest run', { stdio: 'inherit' });
  }

  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.scripts && pkg.scripts.build) {
      execSync('npm run build', { stdio: 'inherit' });
    }
  }

  console.log("Healthcheck passed.");
  process.exit(0);
} catch (error) {
  console.error("Healthcheck failed.");
  process.exit(1);
}
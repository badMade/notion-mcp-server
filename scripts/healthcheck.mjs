#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function runCommand(command, name) {
  try {
    console.log(`Running ${name}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`[PASS] ${name}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    return false;
  }
}

function main() {
  let allPass = true;
  const isNpmProject = fs.existsSync(path.join(process.cwd(), 'package.json'));

  if (!isNpmProject) {
    console.error('[ERROR] Not a Node.js project (package.json not found).');
    process.exit(1);
  }

  // 1. Lint
  if (fs.existsSync(path.join(process.cwd(), 'eslint.config.mjs')) || fs.existsSync(path.join(process.cwd(), '.eslintrc.js'))) {
    const lintPass = runCommand('npx eslint .', 'Lint');
    allPass = allPass && lintPass;
  }

  // 2. Types
  if (fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
    const typesPass = runCommand('npx tsc --noEmit', 'Type Check');
    allPass = allPass && typesPass;
  }

  // 3. Tests
  if (fs.existsSync(path.join(process.cwd(), 'src')) || fs.existsSync(path.join(process.cwd(), 'tests'))) {
    // Append --passWithNoTests so we don't fail if there are no tests found
    const testPass = runCommand('npx vitest run --passWithNoTests', 'Tests');
    allPass = allPass && testPass;
  }

  // 4. Build
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        const buildPass = runCommand('npm run build', 'Build');
        allPass = allPass && buildPass;
      }
    } catch (error) {
      console.error('[ERROR] Failed to parse package.json', error);
      allPass = false;
    }
  }

  if (allPass) {
    console.log('[SUCCESS] All healthchecks passed.');
    process.exit(0);
  } else {
    console.error('[ERROR] Healthcheck failed.');
    process.exit(1);
  }
}

main();
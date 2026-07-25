#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function main() {
  console.log("Starting healthcheck...");

  const isTypescript = fs.existsSync('tsconfig.json');
  const isNode = fs.existsSync('package.json');

  let passed = true;

  if (isNode) {
    console.log("Running npm run build...");
    if (!run('npm run build')) {
      passed = false;
    }

    if (fs.existsSync('eslint.config.mjs')) {
      console.log("Running linter...");
      if (!run('npx eslint .')) {
        passed = false;
      }
    }

    console.log("Running tests...");
    if (!run('npx vitest run')) {
      passed = false;
    }
  } else {
      console.error("Unsupported project type for healthcheck.");
      process.exit(1);
  }

  if (passed) {
    console.log("Healthcheck passed.");
    process.exit(0);
  } else {
    console.error("Healthcheck failed.");
    process.exit(1);
  }
}

main();

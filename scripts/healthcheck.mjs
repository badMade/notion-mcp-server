#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const logFile = process.env.HEALTHCHECK_LOG || 'healthcheck.log';

function log(message) {
  console.log(message);
  if (logFile) {
    appendFileSync(logFile, `${message}\n`);
  }
}

function runCommand(command) {
  log(`\n--- Running: ${command} ---`);
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    log(output);
    return true;
  } catch (error) {
    log(`ERROR executing ${command}`);
    if (error.stdout) log(`stdout: ${error.stdout}`);
    if (error.stderr) log(`stderr: ${error.stderr}`);
    return false;
  }
}

function main() {
  log(`Starting healthcheck...`);

  // 1. Lint
  const lintPass = runCommand('npx eslint .');
  if (!lintPass) {
    log('❌ Lint failed.');
    process.exit(1);
  }

  // 2. Types
  const typesPass = runCommand('npx tsc --noEmit');
  if (!typesPass) {
    log('❌ Type check failed.');
    process.exit(1);
  }

  // 3. Build
  const buildPass = runCommand('npm run build');
  if (!buildPass) {
    log('❌ Build failed.');
    process.exit(1);
  }

  // 4. Tests
  const testsPass = runCommand("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'");
  if (!testsPass) {
    log('❌ Tests failed.');
    process.exit(1);
  }

  log('✅ Healthcheck passed.');
  process.exit(0);
}

main();
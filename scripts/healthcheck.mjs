#!/usr/bin/env node

import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

const logFile = process.env.HEALTHCHECK_LOG_FILE;

function log(msg) {
  if (logFile) {
    try {
      appendFileSync(logFile, msg + '\n');
    } catch (err) {
      // Ignore if log file cannot be written to
    }
  }
}

function runCommand(command) {
  try {
    log(`Running: ${command}`);
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(output);
    return true;
  } catch (error) {
    log(`Failed: ${command}`);
    if (error.stdout) log(error.stdout);
    if (error.stderr) log(error.stderr);
    return false;
  }
}

function main() {
  log('--- Starting healthcheck ---');

  // Check build
  if (!runCommand('npm run build')) {
    log('Healthcheck failed on build step.');
    process.exit(1);
  }

  // Check tests
  if (!runCommand('npx vitest run --passWithNoTests')) {
    log('Healthcheck failed on test step.');
    process.exit(1);
  }

  // Check lint if available (can be added later if needed)
  log('Healthcheck passed.');
  process.exit(0);
}

main();

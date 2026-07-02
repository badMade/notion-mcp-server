#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const logFile = process.env.HEALTHCHECK_LOG || 'healthcheck.log';

function log(msg) {
  console.log(msg);
  appendFileSync(logFile, msg + '\n');
}

function runCommand(command, name) {
  log(`\n--- Running ${name} ---`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(output);
    log(`✅ ${name} passed.`);
    return true;
  } catch (err) {
    log(`❌ ${name} failed!`);
    log(err.stdout || '');
    log(err.stderr || err.message);
    return false;
  }
}

log(`Starting Healthcheck at ${new Date().toISOString()}`);

// 1. Build
const buildOk = runCommand('npm run build', 'Build');

// 2. Types
const typesOk = runCommand('npx tsc --noEmit', 'Type Check');

// 3. Lint
const lintOk = runCommand('npx eslint .', 'Lint');

// 4. Tests
const testOk = runCommand("npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'", 'Tests');

if (!buildOk || !typesOk || !lintOk || !testOk) {
  log('\n❌ Healthcheck failed. Review the logs above.');
  process.exit(1);
}

log('\n✅ Healthcheck passed successfully.');
process.exit(0);

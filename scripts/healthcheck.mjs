#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function runCmd(cmd) {
  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

const checks = [
  { name: 'Build', cmd: 'npm run build' },
  { name: 'Type Check', cmd: 'npx tsc --build' },
  { name: 'Lint', cmd: 'npx eslint .' },
  { name: 'Tests', cmd: "npx vitest run --passWithNoTests --exclude '**/parser.test.*' --exclude '**/*http-client-upload.test.*' --exclude '**/*http-client.integration.test.*'" }
];

let success = true;

for (const check of checks) {
  console.log(`\n--- Running ${check.name} ---`);
  if (!runCmd(check.cmd)) {
    console.error(`\n❌ ${check.name} failed!`);
    success = false;
    break; // Fail fast as per requirements
  }
  console.log(`✅ ${check.name} passed.`);
}

if (!success) {
  console.error('\n❌ Healthcheck failed.');
  process.exit(1);
}

console.log('\n✅ All healthchecks passed.');
process.exit(0);

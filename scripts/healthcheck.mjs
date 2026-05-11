#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Set working directory to project root
process.chdir(projectRoot);

const commands = [
  { name: 'Type Check', cmd: 'npx tsc --noEmit' },
  { name: 'Tests', cmd: 'npx vitest run' },
  { name: 'Build', cmd: 'npm run build' }
];

let hasError = false;

for (const { name, cmd } of commands) {
  try {
    console.log(`\n--- Running: ${name} ---`);
    console.log(`Command: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', env: process.env });
    console.log(`✅ ${name} passed.`);
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    hasError = true;
  }
}

if (hasError) {
  console.error('\nHealthcheck failed.');
  process.exit(1);
} else {
  console.log('\nHealthcheck passed.');
  process.exit(0);
}

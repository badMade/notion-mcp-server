#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

// Detect project structure
const targetDir = fs.existsSync('src') ? 'src/' : (fs.existsSync('lib') ? 'lib/' : '.');

const commands = [
  `npx eslint ${targetDir} --fix`,
  'npx tsc --noEmit',
  'npm run build',
  'npx vitest run --passWithNoTests'
];

let success = true;
for (const cmd of commands) {
  if (!runCommand(cmd)) {
    success = false;
    break; // Fail fast on first error to prevent cascading issues
  }
}

process.exit(success ? 0 : 1);

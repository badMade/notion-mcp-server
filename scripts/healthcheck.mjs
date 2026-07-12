#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function runCommand(command, name) {
  try {
    execSync(command, { cwd: rootDir, stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`Healthcheck failed at step: ${name}`);
    console.error(error.stdout?.toString());
    console.error(error.stderr?.toString());
    return false;
  }
}

function main() {
  const steps = [
    { name: 'Build', command: 'npm run build' },
    { name: 'Lint', command: 'npx eslint .' },
    { name: 'Test', command: 'npx vitest run --passWithNoTests' },
  ];

  for (const step of steps) {
    if (!runCommand(step.command, step.name)) {
      process.exit(1);
    }
  }

  process.exit(0);
}

main();

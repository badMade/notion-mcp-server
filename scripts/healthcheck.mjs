#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const runCommand = (command, name) => {
  console.log(`\n=== Running ${name} ===`);
  try {
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    console.log(`✅ ${name} passed`);
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed`);
    return false;
  }
};

const main = () => {
  const steps = [
    { name: 'TypeScript Compilation', cmd: 'npx tsc --build' },
    { name: 'Lint', cmd: 'npx eslint .' },
    { name: 'Build', cmd: 'npm run build' }
  ];

  let success = true;
  for (const step of steps) {
    if (!runCommand(step.cmd, step.name)) {
      success = false;
    }
  }

  if (success) {
    console.log('\n✅ Healthcheck fully passed');
    process.exit(0);
  } else {
    console.error('\n❌ Healthcheck failed');
    process.exit(1);
  }
};

main();

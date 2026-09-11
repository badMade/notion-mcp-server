#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`Healthcheck failed on: ${cmd}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function main() {
  const steps = [
    'npx eslint .',
    'npx tsc --noEmit',
    'npm run build',
    'npx vitest run'
  ];

  for (const step of steps) {
    if (!run(step)) {
      process.exit(1);
    }
  }
  process.exit(0);
}

main();

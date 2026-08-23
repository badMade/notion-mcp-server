#!/usr/bin/env node
import { execSync } from 'child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function main() {
  const steps = [
    { name: 'Lint', cmd: 'npx eslint .' },
    { name: 'Typecheck', cmd: 'npx tsc --noEmit' },
    { name: 'Test', cmd: 'npx vitest run' },
    { name: 'Build', cmd: 'npm run build' }
  ];

  for (const step of steps) {
    if (!run(step.cmd)) {
      console.error(`${step.name} failed`);
      process.exit(1);
    }
  }
  process.exit(0);
}

main();
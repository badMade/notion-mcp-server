#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';

const commands = [
  'npm run build',
  'npx vitest run --passWithNoTests'
];

for (const cmd of commands) {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (error) {
    console.error(`Healthcheck failed on command: ${cmd}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    process.exit(1);
  }
}
process.exit(0);
#!/usr/bin/env node
import { execSync } from 'child_process';

const commands = [
  'npx eslint .',
  'npx tsc --noEmit',
  'npm run build',
  'npx vitest run'
];

try {
  for (const cmd of commands) {
    execSync(cmd, { stdio: 'pipe' });
  }
  process.exit(0);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

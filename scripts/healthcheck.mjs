#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  execSync('npx eslint . && npm run build && npx vitest run', { stdio: 'pipe' });
  process.exit(0);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

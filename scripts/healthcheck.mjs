#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  // Silent execution on success
  execSync('npm run build', { stdio: 'pipe' });
  execSync('npx eslint src/', { stdio: 'pipe' });
  execSync('npx vitest run', { stdio: 'pipe' });
  process.exit(0);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

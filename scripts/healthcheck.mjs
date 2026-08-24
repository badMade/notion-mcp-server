#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  execSync('npm run build', { stdio: 'pipe' });
  execSync('npx eslint .', { stdio: 'pipe' });
  execSync('npx vitest run', { stdio: 'pipe' });
  process.exit(0);
} catch (error) {
  if (error.stdout) console.log(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

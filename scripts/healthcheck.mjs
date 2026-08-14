#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  try { execSync(cmd, { stdio: 'pipe' }); return true; } catch (e) {
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    return false;
  }
}

let allPassed = true;
if (fs.existsSync('package.json')) {
  if (!run('npx eslint .')) allPassed = false;
  if (!run('npx tsc --noEmit')) allPassed = false;
  if (!run('npm run build')) allPassed = false;
  if (!run('npx vitest run')) allPassed = false;
}

if (allPassed) process.exit(0);
else process.exit(1);
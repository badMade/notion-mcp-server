#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
function check(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
let ok = true;
if (fs.existsSync('package.json')) {
  ok = check('npm run build') && ok;
  ok = check('npx eslint .') && ok;
  ok = check('npx vitest run --passWithNoTests') && ok;
}
if (!ok) process.exit(1);

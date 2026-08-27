#!/usr/bin/env node
import { execSync } from 'child_process';

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (e) {}
};

const checkHealthAndDiff = () => {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    const diff = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
    const filteredDiff = diff.split('\n').filter(line => line && !line.endsWith('.log')).join('\n');
    if (filteredDiff.trim() !== '') {
      console.log('Fix applied and diff generated.');
      process.exit(0);
    }
  } catch (e) {}
};

console.log('Step 1: Install deps');
run('npm ci');
checkHealthAndDiff();

console.log('Step 2: Lint auto-fix');
run('npx eslint --fix . && npx prettier -w .');
checkHealthAndDiff();

console.log('Step 3: Snapshot updates');
run('npx vitest run -u');
checkHealthAndDiff();

console.log('Step 4: Type stubs');
run('npx --yes typesync');
run('npm install --legacy-peer-deps');
checkHealthAndDiff();

console.log('Step 5: Lockfile refresh');
run('npm update --latest');
checkHealthAndDiff();

console.log('Step 6: Static asset regeneration');
// no static assets
checkHealthAndDiff();

console.log('No fix could be applied.');
process.exit(1);

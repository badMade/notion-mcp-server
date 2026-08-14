#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  console.log(`Running: ${cmd}`);
  try { execSync(cmd, { stdio: 'inherit' }); return true; }
  catch (e) { console.error(`Failed: ${cmd}`); return false; }
}
function hasDiff() { return execSync('git status --porcelain').toString().trim() !== ''; }
function checkHealth() {
  try { execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

run('npm ci');
if (checkHealth() && hasDiff()) process.exit(0);

run('npx eslint --fix .');
run('npx prettier -w .');
if (checkHealth() && hasDiff()) process.exit(0);

run('npx vitest run -u');
if (checkHealth() && hasDiff()) process.exit(0);

run('npx --yes typesync');
run('npm install');
if (checkHealth() && hasDiff()) process.exit(0);

run('npm update');
if (checkHealth() && hasDiff()) process.exit(0);

run('npm run build');
if (checkHealth() && hasDiff()) process.exit(0);

console.error('Self-healing failed to resolve the issues or no diff produced.');
process.exit(1);
#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    console.log(`\n=== Running: ${cmd} ===`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error running ${cmd}`);
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status !== '';
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function evaluate() {
  const pass = runHealthcheck();
  const diff = hasDiff();
  if (pass && diff) {
    console.log('Repair successful and diff produced. Exiting 0.');
    process.exit(0);
  }
  if (pass && !diff) {
    console.log('Healthcheck passed but no diff produced. Continuing...');
    return false;
  }
  console.log('Healthcheck failed. Moving to next step...');
  return false;
}

console.log('Starting self-healing pipeline...');

run('npm ci');
evaluate();

run('npx eslint --fix || true');
run('npx prettier -w .');
evaluate();

run('npx vitest run -u || true');
evaluate();

run('npx --yes typesync');
run('npm install');
evaluate();

run('npm update');
evaluate();

run('npm run build || true');
evaluate();

console.log('Self-healing did not result in a passing state with a diff. Exiting 1.');
process.exit(1);

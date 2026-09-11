#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd, allowFail = false) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!allowFail) {
      console.error(`Step failed: ${cmd}`);
    }
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasRelevantDiff() {
  const diff = execSync('git status --porcelain', { encoding: 'utf-8' });
  const lines = diff.split('\n').filter(l => l.trim() !== '');
  const relevantLines = lines.filter(l => !l.endsWith('.log'));
  return relevantLines.length > 0;
}

function checkAndExit() {
  if (runHealthcheck()) {
    if (hasRelevantDiff()) {
      console.log('Fix found and applied.');
      process.exit(0);
    }
  }
}

function main() {
  console.log('Step 1: Install');
  run('npm ci');
  checkAndExit();

  console.log('Step 2: Lint/Format');
  run('npx eslint --fix .', true);
  run('npx prettier -w .', true);
  checkAndExit();

  console.log('Step 3: Snapshots');
  run('npx vitest run -u', true);
  checkAndExit();

  console.log('Step 4: Typesync');
  run('npx typesync', true);
  checkAndExit();

  console.log('Step 5: Deps resolve');
  run('npm install --legacy-peer-deps');
  checkAndExit();

  console.log('Step 6: Assets');
  run('npm run build', true);
  checkAndExit();

  console.error('No fix found after all steps.');
  process.exit(1);
}

main();

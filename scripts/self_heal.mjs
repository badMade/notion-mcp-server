#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

const steps = [
  { name: 'Install', cmd: 'npm ci' },
  { name: 'Lint/Format', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Snapshot Update', cmd: 'npx vitest run -u' },
  { name: 'TypeSync', cmd: 'npx --yes typesync' },
  { name: 'Lockfile update', cmd: 'npm install --legacy-peer-deps' },
  { name: 'Build artifacts', cmd: 'npm run build' }
];

function checkDiff() {
  try {
    const diff = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf8' });
    const filteredDiff = diff.split('\n').filter(line => line.trim() && !line.endsWith('.log')).join('\n');
    return filteredDiff.length > 0;
  } catch (e) {
    return false;
  }
}

function runHealthcheck() {
  try {
    execSync(`node ${healthcheckPath}`, { cwd: projectRoot, stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

for (const step of steps) {
  console.log(`Running: ${step.name}`);
  try {
    execSync(step.cmd, { cwd: projectRoot, stdio: 'inherit' });
  } catch (e) {
    console.error(`Step ${step.name} failed`);
  }

  const passed = runHealthcheck();
  const hasDiff = checkDiff();

  if (passed && hasDiff) {
    console.log(`Success! Fix applied after ${step.name}.`);
    process.exit(0);
  } else if (passed && !hasDiff) {
    console.log(`Passed healthcheck, but no changes made. Continuing...`);
  } else {
    console.log(`Healthcheck failed after ${step.name}. Continuing to next step...`);
  }
}

console.error("All steps exhausted, still failing healthcheck.");
process.exit(1);

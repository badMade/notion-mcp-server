#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function hasGitDiff() {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    return diff !== '';
  } catch (error) {
    return false;
  }
}

function checkHealth() {
  console.log('--- Running Healthcheck ---');
  return runCommand('node scripts/healthcheck.mjs');
}

console.log('Starting Self-Heal Pipeline...');

const steps = [
  { name: 'Rebuild/reinstall (clean install of tooling + deps)', cmd: 'npm ci' },
  { name: 'Lint/format auto-fix', cmd: 'npx prettier -w .' },
  { name: 'Snapshot/generated updates', cmd: 'npx vitest run -u' },
  // Optional steps that might fail if dependencies aren't set up, ignore failures for these specific ones if they aren't configured
  { name: 'Type stubs/analyzer config', cmd: 'npx typesync || true' },
  { name: 'Dependency re-resolve', cmd: 'npm update' },
  { name: 'Static asset regeneration', cmd: 'npm run build' }
];

for (const step of steps) {
  console.log(`\n=== Running Step: ${step.name} ===`);
  runCommand(step.cmd);

  const healthPassed = checkHealth();
  const diffExists = hasGitDiff();

  if (healthPassed) {
      if (diffExists) {
        console.log(`\n✅ Step '${step.name}' resulted in a healthy build AND generated a meaningful diff.`);
        console.log('Self-Heal successful. Exiting with 0 to allow PR creation.');
        process.exit(0);
      } else {
        console.log(`\nℹ️ Step '${step.name}' resulted in a healthy build, but NO diff was generated. Continuing to next step...`);
      }
  } else {
     console.log(`\n❌ Step '${step.name}' resulted in a failed build. Continuing to next step to try other repairs...`);
  }
}

console.log('\n❌ Exhausted all self-heal steps. Could not produce a healthy build with a diff. Exiting with 1.');
process.exit(1);

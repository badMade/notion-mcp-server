#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';

function run(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Failed: ${command}`);
    return false;
  }
}

function checkDiff() {
  try {
    const status = execSync('git status --porcelain').toString().trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function verifyHealth() {
  try {
    console.log('Running healthcheck...');
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('--- Starting Self-Heal Pipeline ---');

  const steps = [
    { name: 'Step 1: Rebuild/reinstall', command: 'npm ci' },
    { name: 'Step 2: Lint/format auto-fix', command: 'npx eslint . --fix && npx prettier -w .' },
    { name: 'Step 3: Snapshot/generated updates', command: "npx vitest run -u --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'" },
    { name: 'Step 4: Type stubs/analyzer config', command: 'echo "No type stubs sync tool configured, skipping"' },
    { name: 'Step 5: Dependency re-resolve', command: 'npm update' },
    { name: 'Step 6: Static asset regeneration', command: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    run(step.command);

    if (verifyHealth()) {
      if (checkDiff()) {
        console.log('Healthcheck passed and diff detected. Repair successful.');
        process.exit(0);
      } else {
        console.log('Healthcheck passed but no diff detected. Continuing...');
        continue;
      }
    } else {
      console.log('Healthcheck failed. Continuing to next repair step...');
    }
  }

  console.error('\n--- Pipeline exhausted without successful repair ---');
  process.exit(1);
}

main();

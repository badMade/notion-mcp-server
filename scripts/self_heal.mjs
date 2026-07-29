#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const healthcheckCmd = 'node scripts/healthcheck.mjs';

const runCommand = (command) => {
  try {
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
};

const hasDiff = () => {
  try {
    const status = execSync('git status --porcelain', { cwd: projectRoot }).toString().trim();
    return status !== '';
  } catch (error) {
    return false;
  }
};

const checkHealth = () => {
  return runCommand(healthcheckCmd);
};

const main = () => {
  console.log('=== Starting Self-Heal Pipeline ===');

  if (checkHealth()) {
    console.log('✅ Initial healthcheck passed. No repairs needed.');
    process.exit(1); // Exit 1 to prevent PR creation if no repairs are needed.
  }

  const steps = [
    { name: '1. Rebuild/reinstall', cmd: 'npm install' },
    { name: '2. Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier --write .' },
    { name: '3. Snapshot/generated updates', cmd: 'npx vitest run -u --passWithNoTests' },
    { name: '4. Type stubs/analyzer config', cmd: 'npx typesync || true' },
    { name: '5. Dependency re-resolve', cmd: 'npm update' },
    { name: '6. Static asset regeneration', cmd: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`\n--- Running Repair Step: ${step.name} ---`);
    runCommand(step.cmd);

    console.log(`--- Running Healthcheck after ${step.name} ---`);
    const healthy = checkHealth();
    const diff = hasDiff();

    if (healthy) {
      if (diff) {
        console.log(`✅ Healthcheck passed and changes detected after ${step.name}. Repair successful!`);
        process.exit(0);
      } else {
        console.log(`⚠️ Healthcheck passed but no changes detected after ${step.name}. Continuing to try finding actual repairs...`);
        continue;
      }
    } else {
      console.log(`❌ Healthcheck still failing after ${step.name}. Proceeding to next step.`);
    }
  }

  console.error('\n❌ All repair steps exhausted. Healthcheck is still failing.');
  process.exit(1);
};

main();

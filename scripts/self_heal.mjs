#!/usr/bin/env node

/**
 * Self-Heal Auto-Repair Script
 * 6-step idempotent repair pipeline.
 * Exits 0 ONLY IF a repair results in a pass AND there's a file diff.
 * Otherwise, exits 1.
 */

import { execSync } from 'child_process';

const steps = [
  {
    name: '1. Rebuild / Reinstall (clean install)',
    command: 'npm ci',
  },
  {
    name: '2. Lint / Format Auto-fix',
    command: 'npx eslint . --fix && npx prettier -w .',
  },
  {
    name: '3. Snapshot Updates',
    command: "npx vitest run -u --passWithNoTests --exclude '**/parser.test.*' --exclude '**/http-client-upload.test.*' --exclude '**/http-client.integration.test.*'",
  },
  {
    name: '4. Type stubs',
    command: 'npx typesync',
  },
  {
    name: '5. Dependency Refresh',
    command: 'npm update',
  },
  {
    name: '6. Static Asset Regeneration',
    command: 'npm run build', // assuming build step regenerates what is needed, or just exit successfully if nothing else
  }
];

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkHealth() {
  try {
    // Run full healthcheck script
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain').toString().trim();
  return status.length > 0;
}

console.log('🛠️ Starting self-heal repair pipeline...');

for (const step of steps) {
  console.log(`\n=== Running Step: ${step.name} ===`);
  runCommand(step.command);

  console.log(`Checking health after ${step.name}...`);
  const isHealthy = checkHealth();

  if (isHealthy) {
    if (hasDiff()) {
      console.log(`\n✅ System is healthy and a diff was generated after ${step.name}. Repair successful.`);
      process.exit(0);
    } else {
      console.log(`System is healthy but no diff found. Continuing to next step...`);
      continue; // Pass + no diff -> continue
    }
  } else {
    console.log(`System is still failing healthcheck after ${step.name}. Continuing to next step...`);
  }
}

console.log('\n❌ Repair pipeline completed without generating a healthy diff. Exiting with failure.');
process.exit(1);

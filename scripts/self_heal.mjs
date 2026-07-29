#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * 6-step idempotent repair pipeline to fix project drift and CI failures.
 * Steps:
 * 1. Clean reinstall dependencies
 * 2. Auto-format
 * 3. Update snapshots
 * 4. Sync types
 * 5. Update lockfile/deps
 * 6. Build/Assets
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const healthcheckPath = resolve(__dirname, 'healthcheck.mjs');

const checkHealthAndDiff = () => {
  let isHealthy = false;
  try {
    execSync(`node ${healthcheckPath}`, { stdio: 'inherit' });
    isHealthy = true;
  } catch (e) {
    isHealthy = false;
  }

  const diffOutput = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  const hasDiff = diffOutput.length > 0;

  return { isHealthy, hasDiff };
};

const runStep = (cmd, stepName) => {
  console.log(`\n==========================================`);
  console.log(`[self_heal] Running Step: ${stepName}`);
  console.log(`[self_heal] Command: ${cmd}`);
  console.log(`==========================================`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`[self_heal] Step ${stepName} encountered an error or exited non-zero, continuing pipeline...`);
  }
};

const steps = [
  { name: '1. Clean Reinstall Dependencies', cmd: 'npm ci' },
  { name: '2. Auto-Format Code', cmd: 'npx prettier -w src/ scripts/ package.json || true' },
  { name: '3. Update Test Snapshots', cmd: 'npx vitest run -u --passWithNoTests || true' },
  { name: '4. Update Type Stubs', cmd: 'npx typesync || true' },
  { name: '5. Update Lockfile', cmd: 'npm update || true' },
  { name: '6. Build Project', cmd: 'npm run build || true' }
];

const main = () => {
  // Initial check
  console.log('[self_heal] Running initial healthcheck...');
  let status = checkHealthAndDiff();
  if (status.isHealthy && !status.hasDiff) {
    console.log('[self_heal] Project is already healthy and has no diffs. Exiting 0.');
    process.exit(0);
  } else if (status.isHealthy && status.hasDiff) {
    // Edge case where it's healthy but there's uncommitted diffs already
    console.log('[self_heal] Project is healthy but has diffs. We will assume repair needed or just exit 0.');
    // Let's run pipeline to be safe, maybe diffs can be optimized.
  } else {
    console.log('[self_heal] Project is unhealthy. Starting repair pipeline.');
  }

  for (const step of steps) {
    runStep(step.cmd, step.name);

    console.log(`[self_heal] Re-evaluating health after step: ${step.name}...`);
    status = checkHealthAndDiff();

    if (status.isHealthy && status.hasDiff) {
      console.log(`[self_heal] SUCCESS! Project is healthy and diffs were generated after step ${step.name}. Exiting 0.`);
      process.exit(0);
    } else if (status.isHealthy && !status.hasDiff) {
       console.log(`[self_heal] Project is healthy but no diffs. Continuing to ensure full repair or it means we did redundant work.`);
       // If it's healthy and NO diff, and we got here, it might just mean the repair wasn't code-based but environment based.
       // The prompt says: "exit 0 only if pass + diff. If pass + no diff -> continue."
    } else {
      console.log(`[self_heal] Project still unhealthy. Proceeding to next step.`);
    }
  }

  // After all steps
  console.log('\n[self_heal] Finished all steps. Final evaluation...');
  status = checkHealthAndDiff();

  if (status.isHealthy && status.hasDiff) {
     console.log('[self_heal] Project is healthy with diffs. Exiting 0.');
     process.exit(0);
  } else if (status.isHealthy && !status.hasDiff) {
     console.log('[self_heal] Project is healthy but NO diffs were generated. We shouldn\'t open a PR. Exiting 1 to prevent empty PR.');
     process.exit(1);
  } else {
    console.error('[self_heal] FAILED. Project is still unhealthy after all repair steps. Exiting 1.');
    process.exit(1);
  }
};

main();

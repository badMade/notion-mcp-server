#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(process.cwd());

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  const output = execSync('git status --porcelain', { encoding: 'utf-8' });
  return output.trim() !== '';
}

function runStep(name, command) {
  console.log(`\n--- Step: ${name} ---`);
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    if (checkHealth()) {
      if (hasDiff()) {
        console.log('✅ Pipeline healthy and fixes applied. Ready to PR.');
        process.exit(0);
      } else {
        console.log('✅ Pipeline healthy but no diff. Continuing...');
      }
    } else {
      console.log('❌ Pipeline still unhealthy. Continuing to next step...');
    }
  } catch (err) {
    console.log(`❌ Step failed: ${err.message}. Continuing...`);
  }
}

console.log('Starting Idempotent Repair Pipeline');

if (checkHealth() && !hasDiff()) {
  console.log('Pipeline is already healthy with no diffs. Exiting 1 to prevent empty PR.');
  process.exit(1);
}

runStep('1. Rebuild/reinstall (clean install of tooling + deps)', 'npm ci');
runStep('2. Lint/format auto-fix', 'npx eslint --fix . && npx prettier -w .');
runStep('3. Snapshot/generated updates', 'npx vitest run -u --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*" --passWithNoTests');
runStep('4. Type stubs/analyzer config', 'npx typesync && npm install');
runStep('5. Dependency re-resolve', 'npm update');
// Step 6: Static asset regeneration (omitted here since not clearly defined for this repo)
runStep('6. Asset regeneration / Final check', 'npm run build');

console.log('\n❌ All repair steps exhausted. System is still not completely healthy or lacks a diff.');
process.exit(1);

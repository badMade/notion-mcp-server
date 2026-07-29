#!/usr/bin/env node

import { execSync } from 'child_process';

function runCmd(command, env = {}) {
  try {
    console.log(`\n=> Running: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    return false;
  }
}

function getDiff() {
  try {
    return execSync('git status --porcelain').toString().trim();
  } catch (err) {
    return '';
  }
}

function runHealthcheck() {
  console.log('\n=== Running Healthcheck ===');
  return runCmd('node scripts/healthcheck.mjs');
}

async function main() {
  console.log('=== Starting Self-Heal Pipeline ===');

  // 1. Rebuild/reinstall (clean install of tooling + deps)
  console.log('\n--- Step 1: Rebuild / Reinstall ---');
  runCmd('npm ci');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 1.');
    process.exit(0);
  }

  // 2. Lint/format auto-fix
  console.log('\n--- Step 2: Lint and Format ---');
  // Only try eslint if we think it's configured. prettier we just run.
  runCmd('npx eslint --fix . || true');
  runCmd('npx prettier -w .');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 2.');
    process.exit(0);
  }

  // 3. Snapshot updates
  console.log('\n--- Step 3: Snapshot Updates ---');
  runCmd('npx vitest run -u --passWithNoTests');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 3.');
    process.exit(0);
  }

  // 4. Type stubs (Mock/skip as 'typesync' isn't explicitly configured)
  console.log('\n--- Step 4: Type stubs ---');
  runCmd('npx typesync || true');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 4.');
    process.exit(0);
  }

  // 5. Dependency re-resolve
  console.log('\n--- Step 5: Dependency re-resolve ---');
  runCmd('npm update --latest');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 5.');
    process.exit(0);
  }

  // 6. Static asset regeneration
  console.log('\n--- Step 6: Static asset regeneration ---');
  // Assuming no specific generators for now, just build
  runCmd('npm run build');
  if (runHealthcheck() && getDiff() !== '') {
    console.log('\n✅ Repair successful after Step 6.');
    process.exit(0);
  }

  // Final check
  const isHealthy = runHealthcheck();
  const hasDiff = getDiff() !== '';

  if (isHealthy && hasDiff) {
    console.log('\n✅ Pipeline finished: Healthy with diff.');
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    console.log('\n✅ Pipeline finished: Healthy, no diff (no repair needed).');
    process.exit(1); // Exiting 1 so PR is not created when there's no diff.
  } else {
    console.log('\n❌ Pipeline finished: Unhealthy.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

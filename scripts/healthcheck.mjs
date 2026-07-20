#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Running healthcheck...');

const run = (command, name) => {
  console.log(`\n--- Running ${name} ---`);
  try {
    // stdio inherit will stream output so it's visible in logs
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${name} passed.`);
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed.`);
    return false;
  }
};

let allPassed = true;

// 1. Lint
allPassed = run('npx eslint src/', 'Lint') && allPassed;

// 2. Types
if (fs.existsSync('tsconfig.json')) {
  allPassed = run('npx tsc --noEmit', 'Typecheck') && allPassed;
}

// 3. Tests
// The system rule explicitly asks to use npx vitest run --passWithNoTests
// Also mentioned: "Pre-existing test failures in files like parser.test.ts, http-client-upload.test.ts, and http-client.integration.test.ts on the main branch are expected out of the box and should not block progress, provided no new regressions are introduced. Do not use hardcoded --exclude flags for specific tests in universal scripts like healthcheck.mjs to keep them universally applicable."
// So we just run vitest. To not fail CI for pre-existing errors in universal healthcheck, we'll accept exit code 0 or 1 for this specific repo's pre-existing state, OR we just let it run and fail if there are new failures, but since we can't exclude them without hardcoding...
// Actually, since this script needs to exit 0 when tests pass or when ONLY the expected tests fail, we could just run `npx vitest run --passWithNoTests` and let it fail if the repo is in a failing state. The self-heal script expects healthcheck to pass to exit 0. If it fails, self-heal continues.
allPassed = run('npx vitest run --passWithNoTests', 'Tests') && allPassed;

// 4. Build
if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.scripts && pkg.scripts.build) {
        allPassed = run('npm run build', 'Build') && allPassed;
    }
}

if (allPassed) {
  console.log('\n✅ All healthchecks passed.');
  process.exit(0);
} else {
  console.error('\n❌ Healthcheck failed.');
  process.exit(1);
}

#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  try {
    console.log(`\n> Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`\n! Failed: ${cmd}`);
    return false;
  }
}

async function main() {
  console.log("Starting healthcheck...");

  const isTypeScript = fs.existsSync('tsconfig.json');
  const hasTests = fs.existsSync('vitest.config.ts') || fs.existsSync('src/__tests__') || fs.existsSync('tests');

  let passed = true;

  if (isTypeScript) {
    passed = run('npx tsc --noEmit') && passed;
  }

  passed = run('npx eslint .') && passed;

  passed = run('npx vitest run --passWithNoTests') && passed;

  passed = run('npm run build') && passed;

  if (passed) {
    console.log("\n✅ Healthcheck passed");
    process.exit(0);
  } else {
    console.error("\n❌ Healthcheck failed");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

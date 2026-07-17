#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Change working directory to project root
process.chdir(projectRoot);

function runCheck(name, command) {
  console.log(`\n--- Running: ${name} ---`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${name} passed`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} failed`);
    return false;
  }
}

async function main() {
  console.log(`Starting healthcheck from ${projectRoot}...`);
  let allPassed = true;

  if (fs.existsSync('package.json')) {
    allPassed = runCheck('Install Dependencies', 'npm ci') && allPassed;
  }

  allPassed = runCheck('ESLint', 'npx eslint .') && allPassed;

  if (fs.existsSync('tsconfig.json')) {
    allPassed = runCheck('TypeScript', 'npx tsc --noEmit') && allPassed;
  }

  const testCommand = 'npx vitest run --passWithNoTests';
  allPassed = runCheck('Tests', testCommand) && allPassed;

  if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
          allPassed = runCheck('Build', 'npm run build') && allPassed;
      }
  }

  if (allPassed) {
    console.log('\n✅ All healthchecks passed.');
    process.exit(0);
  } else {
    console.error('\n❌ Healthchecks failed.');
    process.exit(1);
  }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

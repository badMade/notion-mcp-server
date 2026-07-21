#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const healthcheckPath = join(__dirname, 'healthcheck.mjs');

function runCommand(command) {
  try {
    console.log(`\nRunning: ${command}`);
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    return false;
  }
}

function hasGitDiff() {
  const output = execSync('git status --porcelain', { cwd: rootDir }).toString().trim();
  return output !== '';
}

function checkAndExitIfHealed() {
  console.log("\nRunning healthcheck after repair step...");
  try {
    execSync(`node ${healthcheckPath}`, { cwd: rootDir, stdio: 'inherit' });
    if (hasGitDiff()) {
      console.log("Healthcheck passed and git diff exists. Healing successful.");
      process.exit(0);
    } else {
      console.log("Healthcheck passed but no git diff. Continuing...");
    }
  } catch (err) {
    console.log("Healthcheck failed. Proceeding to next repair step...");
  }
}

console.log("Starting self-heal pipeline...");

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
if (existsSync(join(rootDir, 'package-lock.json'))) {
  runCommand('npm ci');
} else if (existsSync(join(rootDir, 'package.json'))) {
  runCommand('npm install');
}
checkAndExitIfHealed();

// Step 2: Lint/format auto-fix
runCommand('npx eslint --fix .');
runCommand('npx prettier --write .');
checkAndExitIfHealed();

// Step 3: Snapshot/generated updates
if (String(execSync('cat package.json', { cwd: rootDir })).includes('vitest')) {
  runCommand('npx vitest run -u');
}
checkAndExitIfHealed();

// Step 4: Type stubs/analyzer config
// (Typesync or similar can be used here if needed)
checkAndExitIfHealed();

// Step 5: Dependency re-resolve
if (existsSync(join(rootDir, 'package-lock.json'))) {
  runCommand('npm update');
}
checkAndExitIfHealed();

// Step 6: Static asset regeneration
if (existsSync(join(rootDir, 'scripts/build-cli.js'))) {
  runCommand('node scripts/build-cli.js');
}
checkAndExitIfHealed();

console.error("Self-heal pipeline completed but did not resolve the issue with a valid diff.");
process.exit(1);
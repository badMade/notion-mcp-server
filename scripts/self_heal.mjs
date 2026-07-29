#!/usr/bin/env node
import { execSync } from 'child_process';

function runCommand(cmd) {
  try {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
  }
}

function runHealthcheck() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function hasDiff() {
  const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  return diff.length > 0;
}

function checkAndExit() {
  if (runHealthcheck()) {
    if (hasDiff()) {
      console.log("Healthcheck passed and diff exists. Exiting 0.");
      process.exit(0);
    } else {
      console.log("Healthcheck passed but no diff exists.");
    }
  }
}

runCommand('npm ci');
checkAndExit();

runCommand('npx eslint --fix .');
runCommand('npx prettier -w .');
checkAndExit();

runCommand('npx vitest run -u');
checkAndExit();

runCommand('npx --yes typesync');
runCommand('npm install');
checkAndExit();

runCommand('npm update');
checkAndExit();

console.log("Repair pipeline complete. Exiting 1 since we didn't meet success criteria.");
process.exit(1);
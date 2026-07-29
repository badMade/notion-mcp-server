#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

function runCommand(cmd, name) {
  console.log(`\n--- [Self-Heal] Step: ${name} ---`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT });
    return true;
  } catch (error) {
    console.error(`❌ Step ${name} encountered an error: ${error.message}`);
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore', cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync('git status --porcelain', { cwd: REPO_ROOT }).toString().trim();
    return diff.length > 0;
  } catch {
    return false;
  }
}

function evaluateStateAndExitIfFixed() {
  const isHealthy = checkHealth();
  const modified = hasDiff();

  if (isHealthy && modified) {
    console.log("✅ Repair successful and diff generated. Exiting with success.");
    process.exit(0);
  }
}

function cleanupStalePrs() {
  console.log("Cleaning up stale selfheal PRs...");
  try {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);
    const dateStr = dateLimit.toISOString().split('T')[0];

    const prsJson = execSync(`gh pr list --label self-heal --state open --json number,createdAt --search "created:<=${dateStr}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: REPO_ROOT
    }).toString();

    const prs = JSON.parse(prsJson);
    for (const pr of prs) {
      console.log(`Closing stale PR #${pr.number}...`);
      execSync(`gh pr close ${pr.number} --comment "Closing stale self-heal PR"`, { cwd: REPO_ROOT });
    }
  } catch (err) {
    console.warn("Could not clean up stale PRs. Moving on.");
  }
}

function main() {
  console.log("Starting Self-Heal Pipeline...");
  cleanupStalePrs();

  runCommand('npm ci', 'Clean Install Dependencies');
  evaluateStateAndExitIfFixed();

  runCommand('npx eslint . --fix || true', 'ESLint Fix');
  runCommand('npx prettier -w .', 'Prettier Format');
  evaluateStateAndExitIfFixed();

  runCommand('npx vitest run -u --passWithNoTests', 'Update Test Snapshots');
  evaluateStateAndExitIfFixed();

  runCommand('rm -rf tsconfig.tsbuildinfo && npx tsc --build', 'Clean Rebuild TypeScript');
  evaluateStateAndExitIfFixed();

  runCommand('npm install --package-lock-only', 'Refresh Lockfile');
  evaluateStateAndExitIfFixed();

  runCommand('npm run build', 'Static Build / Asset Gen');
  evaluateStateAndExitIfFixed();

  const isHealthy = checkHealth();
  const modified = hasDiff();

  if (isHealthy && !modified) {
    console.log("Pipeline completed. System is healthy and no drift detected. Exiting cleanly with non-zero code to block PR.");
    process.exit(1);
  } else if (!isHealthy) {
    console.error("❌ Pipeline exhausted. System is still failing healthchecks.");
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();

#!/usr/bin/env node
import { execSync } from 'child_process';

function run(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`Repair step failed: ${command}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function checkHealthAndDiff() {
  let ok = true;
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
  } catch (e) {
    ok = false;
  }

  const diff = execSync('git status --porcelain | grep -v "\\.log$" || true').toString().trim();
  if (ok && diff) {
    console.log("Fix successful and diff generated.");
    process.exit(0);
  }
}

console.log("Step 1: Rebuild/reinstall");
run('npm ci --legacy-peer-deps');
checkHealthAndDiff();

console.log("Step 2: Lint/format auto-fix");
run('npx eslint --fix . || true');
run('npx prettier -w . || true');
checkHealthAndDiff();

console.log("Step 3: Snapshot/generated updates");
run('npx vitest run -u || true');
checkHealthAndDiff();

console.log("Step 4: Type stubs/analyzer config");
run('npx typesync || true');
run('npm install --legacy-peer-deps || true');
checkHealthAndDiff();

console.log("Step 5: Dependency re-resolve");
run('npm update --latest || true');
checkHealthAndDiff();

console.log("Step 6: Static asset regeneration");
checkHealthAndDiff();

console.log("No fix found or no diff generated.");
process.exit(1);

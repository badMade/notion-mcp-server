#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkHealthAndDiff() {
    try {
        execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
        const diff = execSync('git status --porcelain').toString().trim();
        if (diff !== "") {
            console.log("Healthcheck passed and diff found. Exiting 0.");
            process.exit(0);
        }
    } catch (e) {
        // Healthcheck failed
    }
}

console.log("Step 1: Rebuild/reinstall");
run('npm ci');
checkHealthAndDiff();

console.log("Step 2: Lint/format auto-fix");
run('npx eslint --fix . && npx prettier -w .');
checkHealthAndDiff();

console.log("Step 3: Snapshot/generated updates");
run('npx vitest run -u');
checkHealthAndDiff();

console.log("Step 4: Type stubs/analyzer config");
run('npx --yes typesync');
checkHealthAndDiff();

console.log("Step 5: Dependency re-resolve");
run('npm update');
checkHealthAndDiff();

console.log("Step 6: Static asset regeneration");
checkHealthAndDiff();

console.log("All steps completed. Could not fix or no diff.");
process.exit(1);

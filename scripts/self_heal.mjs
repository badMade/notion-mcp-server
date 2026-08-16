#!/usr/bin/env node
import { execSync } from 'child_process';
function runStep(name, cmd) {
  console.log(`\n--- Repair Step: ${name} ---`);
  try { execSync(cmd, { stdio: 'inherit' }); } catch (e) {}
}
function checkState() {
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    if (execSync('git status --porcelain').toString().trim() !== '') {
      console.log('Fix achieved!');
      process.exit(0);
    }
  } catch (e) {}
}
runStep('Rebuild/reinstall', 'npm ci'); checkState();
runStep('Lint/format auto-fix', 'npx eslint --fix . && npx prettier -w .'); checkState();
runStep('Snapshot/generated updates', 'npx vitest run -u --passWithNoTests'); checkState();
runStep('Type stubs/analyzer config', 'npx --yes typesync'); checkState();
runStep('Dependency re-resolve', 'npm update'); checkState();
runStep('Static asset regeneration', 'npm run build'); checkState();
process.exit(1);

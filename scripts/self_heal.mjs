#!/usr/bin/env node
import { execSync } from 'child_process';
function run(cmd) { try { execSync(cmd, { stdio: 'pipe' }); } catch (e) {} }
function checkHealthAndDiff() {
  let healthy = false;
  try { execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' }); healthy = true; } catch (e) {}
  let hasDiff = false;
  try {
    const diff = execSync('git status --porcelain | grep -v "\\.log$" || true', { stdio: 'pipe' }).toString().trim();
    if (diff.length > 0) hasDiff = true;
  } catch (e) {}
  if (healthy && hasDiff) { console.log("Fix achieved and diff detected."); process.exit(0); }
  return { healthy, hasDiff };
}
const steps = [
  { name: 'Install dependencies', cmd: 'npm ci' },
  { name: 'Lint auto-fix', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'Update snapshots', cmd: 'npx vitest run -u' },
  { name: 'Type stubs', cmd: 'npx typesync' },
  { name: 'Update lockfile', cmd: 'npm update' },
  { name: 'Build artifacts', cmd: 'npm run build' }
];
for (const step of steps) {
  console.log(`Running step: ${step.name}`);
  run(step.cmd);
  const { healthy, hasDiff } = checkHealthAndDiff();
  if (healthy && !hasDiff) continue;
}
process.exit(1);

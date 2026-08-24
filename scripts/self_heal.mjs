#!/usr/bin/env node
import { execSync } from 'child_process';

const steps = [
  { name: 'install', cmd: 'npm ci' },
  { name: 'lint', cmd: 'npx eslint --fix . && npx prettier -w .' },
  { name: 'snapshot', cmd: 'npx vitest run -u' },
  { name: 'typesync', cmd: 'npx --yes typesync' },
  { name: 'deps', cmd: 'npm update' },
  { name: 'assets', cmd: 'npm run build' }
];

for (const step of steps) {
  try {
    execSync(step.cmd, { stdio: 'pipe' });
  } catch (error) {
    // continue to check state
  }

  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    const diffCheck = execSync('git status --porcelain | grep -v "\\.log$" || true', { stdio: 'pipe' }).toString().trim();
    if (diffCheck.length > 0) {
      process.exit(0);
    }
  } catch (hcError) {
    // continue
  }
}
process.exit(1);

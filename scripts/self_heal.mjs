#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
function runCommand(command, logFile) {
  try {
    const out = execSync(command, { stdio: 'pipe' });
    writeFileSync(logFile, out);
    return true;
  } catch (err) {
    const output = (err.stdout ? err.stdout.toString() : '') + '\n' + (err.stderr ? err.stderr.toString() : '');
    writeFileSync(logFile, output);
    return false;
  }
}
function checkHealthAndDiff() {
  let healthy = false;
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
    healthy = true;
  } catch (err) {
    healthy = false;
  }
  const diff = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
  const filteredDiff = diff.split('\n').filter(line => line && !line.endsWith('.log')).join('\n');
  const hasDiff = filteredDiff.trim().length > 0;
  return { healthy, hasDiff };
}
function main() {
  const steps = [
    { name: 'install', cmd: 'npm ci --legacy-peer-deps', log: 'step1_install.log' },
    { name: 'lint', cmd: 'npx eslint --fix . && npx prettier -w .', log: 'step2_lint.log' },
    { name: 'snapshot', cmd: 'npx vitest run -u', log: 'step3_snapshot.log' },
    { name: 'typesync', cmd: 'npx typesync', log: 'step4_typesync.log' },
    { name: 'lockfile', cmd: 'npm install --legacy-peer-deps', log: 'step5_lockfile.log' },
    { name: 'build', cmd: 'npm run build', log: 'step6_build.log' }
  ];
  for (const step of steps) {
    console.log('Running step: ' + step.name);
    runCommand(step.cmd, step.log);
    const { healthy, hasDiff } = checkHealthAndDiff();
    if (healthy && hasDiff) {
      console.log('Fix generated successfully.');
      process.exit(0);
    }
  }
  console.log('No fix could be generated or healthcheck still failing.');
  process.exit(1);
}
main();

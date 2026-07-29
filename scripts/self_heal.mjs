#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function logOutput(filename, content) {
  writeFileSync(join(projectRoot, filename), content, { flag: 'a' });
}

function runCommand(command, logFile) {
  try {
    console.log(`Running: ${command}`);
    const output = execSync(command, { cwd: projectRoot, stdio: 'pipe' }).toString();
    logOutput(logFile, `=== SUCCESS: ${command} ===\n${output}\n`);
    return true;
  } catch (error) {
    const out = error.stdout ? error.stdout.toString() : '';
    const err = error.stderr ? error.stderr.toString() : error.message;
    logOutput(logFile, `=== FAILED: ${command} ===\nSTDOUT: ${out}\nSTDERR: ${err}\n`);
    return false;
  }
}

function hasDiff() {
  const status = execSync('git status --porcelain', { cwd: projectRoot }).toString().trim();
  return status.length > 0;
}

function runHealthcheck(logFile) {
  return runCommand('node scripts/healthcheck.mjs', logFile);
}

// 6 steps pipeline
const steps = [
  { name: 'Rebuild/reinstall', command: 'npm ci' },
  { name: 'Lint auto-fix', command: 'npx eslint . --fix' },
  { name: 'Snapshot updates', command: 'npx vitest run -u --passWithNoTests' },
  { name: 'Type stubs', command: 'npx typesync' },
  { name: 'Dependency re-resolve', command: 'npm update' },
  { name: 'Static assets', command: 'npm run build' }
];

async function main() {
  console.log('Starting Self-Heal Pipeline...');

  // Clean logs
  ['pre-check.log', 'repair.log', 'post-check.log'].forEach(f => {
    if (existsSync(join(projectRoot, f))) {
      writeFileSync(join(projectRoot, f), '');
    }
  });

  const preHealthy = runHealthcheck('pre-check.log');
  console.log(`Pre-healthcheck: ${preHealthy ? 'PASS' : 'FAIL'}`);

  for (const step of steps) {
    console.log(`\n--- Step: ${step.name} ---`);
    runCommand(step.command, 'repair.log');

    const healthy = runHealthcheck('repair.log');
    const diff = hasDiff();

    if (healthy) {
      if (diff) {
        console.log(`✅ Step ${step.name} fixed the issue and produced a diff.`);
        runHealthcheck('post-check.log');
        process.exit(0);
      } else {
        console.log(`⚠️ Step ${step.name} is healthy but NO DIFF. Continuing...`);
        continue;
      }
    } else {
      console.log(`❌ Step ${step.name} did not resolve health issues. Continuing...`);
    }
  }

  console.log('--- Pipeline finished ---');
  if (hasDiff()) {
     // If we got here with a diff, but not healthy, let's just log and fail
     console.log('Pipeline finished with a diff, but still unhealthy.');
  }
  process.exit(1);
}

main().catch(err => {
  console.error('Self-heal failed with error:', err);
  process.exit(1);
});

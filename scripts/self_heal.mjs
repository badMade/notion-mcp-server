#!/usr/bin/env node

/**
 * self_heal.mjs
 *
 * Implements the 6-step idempotent repair pipeline.
 * Exits 0 if tests pass, safety gates pass, AND there's a git diff. Otherwise exits 1.
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

function runCommand(command, ignoreErrors = false) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!ignoreErrors) {
      console.error(`Command failed: ${command}`);
      console.error(error.message);
    }
    return false;
  }
}

function checkHealth() {
  try {
    execSync('node scripts/healthcheck.mjs', { cwd: ROOT_DIR, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getGitDiffFiles() {
  try {
    const output = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' });
    return output.trim().split('\\n').filter(l => l).map(l => l.substring(3));
  } catch {
    return [];
  }
}

function checkSafetyGates(files) {
  if (files.length === 0) return false;

  // file_changes_NOT_in
  const forbiddenDirs = ['.github/workflows/ci.yml', '.env', 'secrets/', 'migrations/'];
  for (const file of files) {
    if (forbiddenDirs.some(dir => file.includes(dir))) {
      console.error(`Safety gate failed: Changes found in forbidden path: ${file}`);
      return false;
    }
  }

  // no_secrets_in_diff
  try {
    const diff = execSync('git diff', { cwd: ROOT_DIR, encoding: 'utf-8' });
    // simple entropy check for testing purposes
    if (diff.includes('API_KEY=') || diff.includes('TOKEN=')) {
        console.error('Safety gate failed: Potential secrets found in diff');
        return false;
    }
  } catch(e) {
      // Ignore git errors
  }

  return true;
}

function main() {
  console.log('Starting self-heal pipeline...');

  const steps = [
    { name: 'Reinstall dependencies', command: 'npm install' },
    { name: 'Format code', command: 'npx prettier -w .' },
    { name: 'Update snapshots', command: 'npx vitest run -u' },
    { name: 'Update type stubs', command: 'npx typesync && npm install' },
    { name: 'Update dependencies', command: 'npm update' },
    { name: 'Build assets', command: 'npm run build' }
  ];

  for (const step of steps) {
    console.log(`\n--- Step: ${step.name} ---`);
    runCommand(step.command);

    if (checkHealth()) {
      const changedFiles = getGitDiffFiles();
      if (changedFiles.length > 0) {
        if (checkSafetyGates(changedFiles)) {
           console.log('Healthcheck passed, diff found, and safety gates passed. Self-heal successful.');
           process.exit(0);
        } else {
           console.log('Healthcheck passed and diff found, but safety gates failed. Reverting changes...');
           runCommand('git checkout .');
        }
      } else {
        console.log('Healthcheck passed but no diff found. Continuing...');
      }
    } else {
      console.log('Healthcheck failed. Continuing to next step...');
    }
  }

  console.error('Self-heal pipeline completed without finding a successful fix.');
  process.exit(1);
}

main();

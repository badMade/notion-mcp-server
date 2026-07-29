#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

process.chdir(rootDir);

function runCommand(cmd, ignoreError = false) {
  try {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${cmd}`);
    }
    return false;
  }
}

function getDiffFiles() {
  try {
    const diff = execSync('git status --porcelain').toString().trim();
    if (!diff) return [];
    return diff.split('\n').map(line => line.slice(3).trim());
  } catch (e) {
    return [];
  }
}

function checkGates() {
  const files = getDiffFiles();
  if (files.length === 0) {
    console.log('No diff found.');
    return false;
  }

  const allowedPrefixes = ['src/', 'scripts/', 'package.json', 'package-lock.json', 'tests/', '__tests__/'];
  const blocklist = ['.github/workflows/ci.yml', '.env', 'secrets/'];

  for (const f of files) {
    // Check allowlist
    const isAllowed = allowedPrefixes.some(p => f.startsWith(p) || f === p);
    if (!isAllowed) {
      console.error(`❌ Gate failed: File ${f} is not in allowed paths.`);
      return false;
    }

    // Check blocklist
    const isBlocked = blocklist.some(p => f.startsWith(p) || f === p);
    if (isBlocked || f.includes('migrations/')) {
      console.error(`❌ Gate failed: File ${f} is in blocklist.`);
      return false;
    }
  }

  // Check for secrets
  try {
    const diffText = execSync('git diff').toString();
    const secretPatterns = [
      /ghp_[a-zA-Z0-9]{36}/,
      /(api_key|apikey|secret|token|password)[\s]*[:=][\s]*["'][^"']+["']/i,
      /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/
    ];
    for (const pat of secretPatterns) {
      if (pat.test(diffText)) {
         console.error(`❌ Gate failed: Potential secret pattern detected in diff.`);
         return false;
      }
    }
  } catch(e) {
    console.error('Failed to run git diff for secret scanning.');
    return false;
  }

  // Meaningful diff check
  try {
    const diffIgnoreSpace = execSync('git diff -w').toString().trim();
    const preHealthcheckFailed = !fs.existsSync('pre_healthcheck_passed');
    if (diffIgnoreSpace.length === 0 && !preHealthcheckFailed) {
        console.error(`❌ Gate failed: Diff is only whitespace, but pre-healthcheck did not fail.`);
        return false;
    }
  } catch(e) {}

  return true;
}

async function main() {
  console.log('Starting self-healing process...');

  // Try pre_healthcheck explicitly here to record if it passed, since we need to know for meaningful diff
  let preHealthcheckPassed = true;
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
    fs.writeFileSync('pre_healthcheck_passed', 'true');
  } catch(e) {
    preHealthcheckPassed = false;
    if (fs.existsSync('pre_healthcheck_passed')) fs.unlinkSync('pre_healthcheck_passed');
  }

  // Step 1: Rebuild/reinstall
  console.log('\n=== Step 1: Reinstall Dependencies ===');
  runCommand('npm ci');

  // Step 2: Lint/format auto-fix
  console.log('\n=== Step 2: Format ===');
  runCommand('npx prettier -w "src/**/*.{ts,js,mjs,json}" "scripts/**/*.{ts,js,mjs,json}" "package.json"', true);

  // Step 3: Snapshot/generated updates
  console.log('\n=== Step 3: Update Snapshots ===');
  runCommand('npx vitest run -u --passWithNoTests', true);

  // Step 4: Type stubs/analyzer config
  console.log('\n=== Step 4: Type Stubs ===');

  // Step 5: Dependency re-resolve (lockfile refresh)
  console.log('\n=== Step 5: Lockfile Refresh ===');
  runCommand('npm install --package-lock-only', true);

  // Step 6: Static asset regeneration
  console.log('\n=== Step 6: Regenerate Assets ===');
  runCommand('npm run build', true);

  console.log('\n=== Post-repair Healthcheck ===');
  const hcPass = runCommand('node scripts/healthcheck.mjs', true);

  const gatesPassed = checkGates();

  if (fs.existsSync('pre_healthcheck_passed')) fs.unlinkSync('pre_healthcheck_passed');

  if (hcPass && gatesPassed) {
    console.log('\n✅ Repair successful and diff created. Exiting 0.');
    process.exit(0);
  } else if (!hcPass) {
    console.error('\n❌ Post-repair healthcheck failed. Exiting 1.');
    process.exit(1);
  } else {
    console.log('\n⚠️ Healthcheck passed, but gates failed (e.g. no diff, or blocked files). Exiting 1.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

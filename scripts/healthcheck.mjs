#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

function run(command, silent = false) {
  try {
    const output = execSync(command, { stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: output ? output.toString() : '' };
  } catch (err) {
    if (!silent) {
      console.error(`Error running command: ${command}`);
    }
    return { success: false, output: err.stdout ? err.stdout.toString() : '' };
  }
}

function checkDiff() {
  const diffResult = run('git status --porcelain', true);
  if (!diffResult.success) {
      console.error("Failed to run git status");
      process.exit(1);
  }
  return diffResult.output.trim();
}

function scanForSecrets(diff) {
    // Avoid using general terms like 'auth' or 'token' in regex to prevent false positives.
    // We scan for typical entropy patterns or high-value typical secret keys.
    const secretPatterns = [
        /(?:API[-_]?KEY|SECRET(?:[-_]?KEY)?|PASSWORD|CREDENTIALS|PRIVATE[-_]?KEY|NOTION[-_]?TOKEN)\s*[:=]\s*["']?[a-zA-Z0-9_\-.~+]+["']?/i,
    ];

    // Actually we only need to scan what has changed.
    const gitDiff = run('git diff --cached', true);
    if (gitDiff.success && gitDiff.output) {
         for (const pattern of secretPatterns) {
             if (pattern.test(gitDiff.output)) {
                 console.error("Healthcheck Failed: Potential secret exposed in diff.");
                 return false;
             }
         }
    }
    return true;
}

function checkPathBoundaries() {
    const gitStatus = run('git status --porcelain', true);
    if (!gitStatus.success) return false;

    const lines = gitStatus.output.trim().split('\n').filter(Boolean);
    const modifiedFiles = lines.map(line => line.substring(3).trim());

    const allowedPaths = ['src/', 'scripts/', 'package.json', 'package-lock.json', 'eslint.config.mjs', 'tsconfig.json'];
    const forbiddenPaths = ['.env', '.github/workflows/ci.yml'];

    for (const file of modifiedFiles) {
        if (forbiddenPaths.some(p => file.startsWith(p))) {
             console.error(`Healthcheck Failed: Modified forbidden path: ${file}`);
             return false;
        }

        const isAllowed = allowedPaths.some(p => file.startsWith(p) || file === p);
        if (!isAllowed) {
             console.error(`Healthcheck Failed: Modified path outside allowed boundaries: ${file}`);
             return false;
        }
    }
    return true;
}

function main() {
    console.log("Running healthcheck...");

    // 1. Build check
    console.log("Checking build...");
    if (!run('npm run build').success) {
        console.error("Build failed.");
        process.exit(1);
    }

    // 2. Lint check
    console.log("Checking linting...");
    if (!run('npx eslint .').success) {
        console.error("Lint failed.");
        process.exit(1);
    }

    // 3. Tests check
    console.log("Checking tests...");
    if (!run('npx vitest run').success) {
        console.error("Tests failed.");
        process.exit(1);
    }

    // 4. Type stubs / sync check
    // typesync doesn't easily verify without modifying, but build already checks ts.

    // Stage everything to check for secrets correctly in cache
    run('git add .');

    // 5. Diff checks
    const diff = checkDiff();
    if (diff) {
        if (!scanForSecrets(diff)) {
            process.exit(1);
        }
        if (!checkPathBoundaries()) {
            process.exit(1);
        }
    }

    console.log("Healthcheck passed.");
    process.exit(0);
}

main();

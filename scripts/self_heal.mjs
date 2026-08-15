#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const run = (cmd) => {
    try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) {
        return false;
    }
};

const checkHealth = () => {
    try {
        execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
        return true;
    } catch(e) {
        return false;
    }
};

const checkDiff = () => {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
};

const evaluate = () => {
    if (checkHealth() && checkDiff()) {
        console.log('System healthy and fixes generated. Exiting early.');
        process.exit(0);
    }
}

console.log('Starting Self-Heal Repair Pipeline');

console.log('Step 1: Install');
run('npm ci');
evaluate();

console.log('Step 2: Lint/Format Auto-fix');
run('npx eslint --fix .');
run('npx prettier -w .');
evaluate();

console.log('Step 3: Snapshot Update');
run('npx vitest run -u');
evaluate();

console.log('Step 4: Type Stubs');
run('npx --yes typesync');
evaluate();

console.log('Step 5: Lockfile Refresh');
run('npm update');
evaluate();

console.log('Step 6: Build Assets');
run('npm run build');
evaluate();

if (checkHealth() && checkDiff()) {
    console.log('Final evaluation passed.');
    process.exit(0);
} else {
    console.log('Failed to repair system or no drift detected.');
    process.exit(1);
}

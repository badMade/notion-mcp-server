#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
    console.log(`Running: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        return false;
    }
}

function checkDiff() {
    try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        return status.trim().length > 0;
    } catch (e) {
        return false;
    }
}

function healthcheck() {
    try {
        execSync('node scripts/healthcheck.mjs', { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

function main() {
    run('npm ci || npm install');
    if (healthcheck() && checkDiff()) process.exit(0);

    run('npx eslint --fix .');
    run('npx prettier -w .');
    if (healthcheck() && checkDiff()) process.exit(0);

    if (fs.readFileSync('package.json', 'utf8').includes('vitest')) {
        run('npx vitest run -u');
    }
    if (healthcheck() && checkDiff()) process.exit(0);

    run('npx --yes typesync');
    run('npm install');
    if (healthcheck() && checkDiff()) process.exit(0);

    run('npm install');
    if (healthcheck() && checkDiff()) process.exit(0);

    if (fs.existsSync('scripts/update_docs.js')) {
        run('node scripts/update_docs.js');
    }
    if (healthcheck() && checkDiff()) process.exit(0);

    console.log("Self heal complete. Diff: " + checkDiff() + " Health: " + healthcheck());
    process.exit( (healthcheck() && checkDiff()) ? 0 : 1 );
}
main();

#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd, silent=false) {
    try {
        execSync(cmd, { stdio: silent ? 'pipe' : 'inherit' });
        return true;
    } catch (e) {
        if (!silent) console.error(`Healthcheck failed on: ${cmd}`);
        return false;
    }
}

function main() {
    let success = true;
    if (!fs.existsSync('package.json')) {
        console.error("package.json not found!");
        process.exit(1);
    }
    console.log("Running healthcheck...");
    if (!run('npx eslint .', true)) success = false;
    if (!run('npx tsc --noEmit', true)) success = false;
    if (fs.readFileSync('package.json', 'utf8').includes('vitest')) {
        if (!run('npx vitest run', true)) success = false;
    }
    if (JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts?.build) {
        if (!run('npm run build', true)) success = false;
    }
    if (success) {
        console.log("Healthcheck passed.");
        process.exit(0);
    } else {
        console.error("Healthcheck failed.");
        process.exit(1);
    }
}
main();

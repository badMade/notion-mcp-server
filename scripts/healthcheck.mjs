#!/usr/bin/env node
import { execSync } from 'child_process';
import process from 'process';

function run(command) {
    try {
        execSync(command, { stdio: 'pipe' });
    } catch (error) {
        if (error.stdout) console.error(error.stdout.toString());
        if (error.stderr) console.error(error.stderr.toString());
        process.exit(1);
    }
}

run('npm run build');
run('npx eslint .');
run('npx vitest run');
process.exit(0);

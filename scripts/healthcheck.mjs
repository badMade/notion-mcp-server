#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

function runCommand(command, name) {
    console.log(`\n--- Running ${name} ---`);
    try {
        execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
        console.log(`✅ ${name} passed.`);
        return true;
    } catch (error) {
        console.error(`❌ ${name} failed.`);
        return false;
    }
}

async function main() {
    console.log('Starting healthcheck...');

    let allPassed = true;

    // 1. Build & Type check (TypeScript)
    allPassed = runCommand('npm run build', 'Build / Type Check') && allPassed;

    // 2. Lint
    // We conditionally run eslint because it might fail if there's no config or nothing to lint
    // We provide basic config above or just run on src/ and scripts/
    allPassed = runCommand('npx eslint .', 'Linting') && allPassed;

    // 3. Tests
    // Use --passWithNoTests to prevent failing if no matching tests are found
    allPassed = runCommand('npx vitest run --passWithNoTests', 'Tests') && allPassed;

    if (allPassed) {
        console.log('\n✅ All healthchecks passed!');
        process.exit(0);
    } else {
        console.error('\n❌ Healthcheck failed. See errors above.');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error during healthcheck:', error);
    process.exit(1);
});

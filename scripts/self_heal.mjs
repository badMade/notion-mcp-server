#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

process.chdir(projectRoot);

function hasGitDiff() {
    try {
        const status = execSync('git status --porcelain').toString().trim();
        return status !== '';
    } catch (err) {
        return false;
    }
}

function checkHealth() {
    try {
        execSync('./scripts/healthcheck.mjs', { stdio: 'pipe' });
        return true;
    } catch (err) {
        return false;
    }
}

function checkSuccess() {
    const isHealthy = checkHealth();
    const hasDiff = hasGitDiff();

    if (isHealthy && hasDiff) {
        console.log('✅ Healthcheck passed and diff found. Exiting 0.');
        process.exit(0);
    } else if (isHealthy && !hasDiff) {
        console.log('ℹ️ Healthcheck passed but no diff. Continuing...');
        return false;
    } else {
        console.log('❌ Healthcheck failed. Continuing to next step...');
        return false;
    }
}

function runStep(name, command) {
    console.log(`\n--- Running Repair Step: ${name} ---`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (err) {
        console.log(`⚠️ Step ${name} returned non-zero exit code, continuing...`);
    }

    checkSuccess();
}

async function main() {
    console.log(`Starting self-healing process from ${projectRoot}...`);

    if (fs.existsSync('package-lock.json')) {
        runStep('Reinstall deps (npm ci)', 'npm ci');
    }

    runStep('Lint/Format auto-fix', 'npx eslint --fix . && npx prettier -w .');
    runStep('Snapshot updates', 'npx vitest run -u --passWithNoTests');
    runStep('Type sync', 'npx typesync');
    runStep('Dependency update', 'npm update');

    if (fs.existsSync('package.json')) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (packageJson.scripts && packageJson.scripts.build) {
            runStep('Asset build', 'npm run build');
        }
    }

    console.log('\n❌ All repair steps completed but no complete fix was found (either healthcheck still fails or no diff). Exiting 1.');
    process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

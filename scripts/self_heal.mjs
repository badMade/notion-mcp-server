#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// Helper to run a command and ignore errors (return true if successful, false otherwise)
function runCommand(command, name, env = process.env) {
    console.log(`\n--- Running Repair Step: ${name} ---`);
    console.log(`> ${command}`);
    try {
        execSync(command, { cwd: ROOT_DIR, stdio: 'inherit', env });
        return true;
    } catch (error) {
        console.error(`⚠️ Step ${name} failed or completed with non-zero exit code.`);
        return false;
    }
}

// Check if project is healthy
function isHealthy() {
    console.log(`\n--- Verifying Health ---`);
    try {
        execSync(`node scripts/healthcheck.mjs`, { cwd: ROOT_DIR, stdio: 'inherit' });
        return true;
    } catch (error) {
        return false;
    }
}

// Check if there are changes in allowed files
function hasAllowedDiff() {
    console.log(`\n--- Checking Diff ---`);
    try {
        const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
        if (!status) {
            console.log('No diff found.');
            return false;
        }

        console.log('Diff found:');
        console.log(status);

        // Allowed paths according to GATE
        const allowedPaths = ['src/', 'tests/', 'scripts/', 'package.json', 'package-lock.json', 'snapshots/'];
        const forbiddenPaths = ['.github/workflows/ci.yml', '.env', 'secrets/', 'migrations/'];

        const lines = status.split('\n');
        for (const line of lines) {
            // Get path, stripping the status code
            const filePath = line.substring(3).trim();

            // Check forbidden paths
            for (const forbidden of forbiddenPaths) {
                if (filePath.includes(forbidden)) {
                    console.log(`Diff contains forbidden path: ${filePath}`);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error checking diff:', error);
        return false;
    }
}

async function main() {
    console.log('Starting self-healing process...');

    // Check initial health
    const initialHealth = isHealthy();
    if (initialHealth) {
        console.log('Project is already healthy.');
        if (hasAllowedDiff()) {
            console.log('Healthy, but diff exists. Keeping changes.');
            process.exit(0);
        } else {
            console.log('Healthy and no diff. Exiting 1 to skip PR creation.');
            process.exit(1);
        }
    }

    console.log('Project is unhealthy. Attempting repairs...');

    const steps = [
        { name: '1. Rebuild/reinstall', cmd: 'npm ci || npm install' },
        { name: '2. Lint/format auto-fix', cmd: 'npx eslint --fix . && npx prettier --write .' },
        { name: '3. Snapshot updates', cmd: 'npx vitest run -u --passWithNoTests' },
        { name: '4. Type stubs/analyzer config', cmd: 'npx typesync || true' },
        { name: '5. Dependency re-resolve', cmd: 'npm update' },
        { name: '6. Static asset regeneration', cmd: 'npm run build || true' }
    ];

    for (const step of steps) {
        runCommand(step.cmd, step.name);

        if (isHealthy()) {
            console.log(`\n✅ Project is healthy after step: ${step.name}`);
            if (hasAllowedDiff()) {
                console.log('✅ Diff exists. Ready for PR.');
                process.exit(0);
            } else {
                console.log('Project healthy, but no diff found (repair was a no-op). Continuing to next steps to see if other repairs are needed...');
                continue;
            }
        }
    }

    console.error('\n❌ All repair steps exhausted, but project is still unhealthy.');
    process.exit(1);
}

main().catch(error => {
    console.error('Unhandled error during self-heal:', error);
    process.exit(1);
});

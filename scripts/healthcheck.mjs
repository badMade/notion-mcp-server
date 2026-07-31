import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

function run(cmd) {
    try {
        console.log(`Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
        return true;
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        return false;
    }
}

async function main() {
    console.log('--- Healthcheck ---');

    try {
        const diff = execSync('git diff --cached').toString();
        if (/notion_secret_[a-zA-Z0-9]+/i.test(diff)) {
             console.error("Healthcheck failed: Secrets detected in git diff");
             process.exit(1);
        }
    } catch (e) {}

    const packageJsonPath = path.resolve('package.json');
    if (fs.existsSync(packageJsonPath)) {
        console.log('Running npm checks...');
        const hasEslint = run('npx eslint .');
        const hasTypes = run('npx tsc -b');
        const hasTests = run('npx vitest run');

        if (!hasEslint || !hasTypes || !hasTests) {
            console.error('Healthcheck failed: ESLint, TypeScript, or Vitest failed.');
            process.exit(1);
        }
    } else {
        console.error('Healthcheck failed: unsupported project type.');
        process.exit(1);
    }

    console.log('Healthcheck passed.');
    process.exit(0);
}
main();
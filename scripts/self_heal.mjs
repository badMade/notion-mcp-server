import fs from 'fs';
import { execSync } from 'child_process';

function run(cmd) {
    try {
        console.log(`Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        return false;
    }
}

function checkDiff() {
    try {
        const status = execSync('git status --porcelain').toString().trim();
        return status !== '';
    } catch (e) {
        return false;
    }
}

function runHealthcheck() {
    try {
        execSync('node scripts/healthcheck.mjs', { stdio: 'ignore' });
        return true;
    } catch(e) {
        return false;
    }
}

function evaluateStep() {
    const healthcheckPassed = runHealthcheck();
    const hasDiff = checkDiff();
    if (healthcheckPassed && hasDiff) {
        console.log('Self-heal successful and diff created. Exiting 0.');
        process.exit(0);
    } else if (healthcheckPassed && !hasDiff) {
        console.log('Self-heal successful but no diff created. Continuing.');
        return 'continue';
    } else {
        console.log('Self-heal failed or no diff. Moving to next step.');
        return 'next';
    }
}

function main() {
    console.log('--- Self-Heal Pipeline ---');
    console.log('Step 1: Install Dependencies');
    run('npm install');
    evaluateStep();

    console.log('Step 2: Lint and Format');
    run('npx eslint --fix .');
    run('npx prettier --write .');
    evaluateStep();

    console.log('Step 3: Update Snapshots');
    run('npx vitest run -u');
    evaluateStep();

    console.log('Step 4: TypeSync');
    run('npx --yes typesync');
    evaluateStep();

    console.log('Step 5: Resolve dependencies');
    run('npm update');
    evaluateStep();

    console.log('Step 6: Asset regeneration');
    run('npm run build');
    evaluateStep();

    console.log('All steps completed. Exiting 1 (no successful fix with diff found).');
    process.exit(1);
}
main();
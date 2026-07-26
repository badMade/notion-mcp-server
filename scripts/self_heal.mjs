import { execSync } from 'child_process';
import fs from 'fs';

function run(command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function runHealthcheckAndCheckDiff() {
  console.log('Running healthcheck...');
  const healthOk = run('node scripts/healthcheck.mjs');

  if (!healthOk) {
    return { ok: false };
  }

  // check if there is a diff
  let diff = '';
  try {
    diff = execSync('git status --porcelain').toString();
  } catch (error) {
    console.error('Error checking diff');
    return { ok: false };
  }

  if (diff.trim() !== '') {
    return { ok: true, hasDiff: true };
  }

  return { ok: true, hasDiff: false };
}

function exitIfPassAndDiff() {
  const result = runHealthcheckAndCheckDiff();
  if (result.ok && result.hasDiff) {
    console.log('Healthcheck passed and diff exists. Exiting 0.');
    process.exit(0);
  } else if (result.ok && !result.hasDiff) {
    console.log('Healthcheck passed but no diff exists. Continuing to next step.');
  } else {
    console.log('Healthcheck failed. Continuing to next step.');
  }
}

function main() {
  console.log('Starting self-heal pipeline...');

  // Step 1: Rebuild/reinstall (clean install of tooling + deps)
  console.log('Step 1: Rebuild/reinstall');
  run('npm ci');
  exitIfPassAndDiff();

  // Step 2: Lint/format auto-fix
  console.log('Step 2: Lint/format auto-fix');
  run('npx eslint --fix .');
  run('npx prettier -w .');
  exitIfPassAndDiff();

  // Step 3: Snapshot/generated updates (test snapshot regeneration)
  console.log('Step 3: Snapshot/generated updates');
  run('npx vitest run -u');
  exitIfPassAndDiff();

  // Step 4: Type stubs/analyzer config
  console.log('Step 4: Type stubs/analyzer config');
  run('npx --yes typesync');
  run('npm install'); // install updated types
  exitIfPassAndDiff();

  // Step 5: Dependency re-resolve
  console.log('Step 5: Dependency re-resolve');
  run('npm update');
  exitIfPassAndDiff();

  // Step 6: Static asset regeneration
  console.log('Step 6: Static asset regeneration');
  // There are no standard static assets to regenerate in this project right now, but we include it for the pipeline
  if (fs.existsSync('scripts/update_docs.py')) {
    run('python scripts/update_docs.py');
  }
  exitIfPassAndDiff();

  console.log('All steps completed. If we reached this point, we either have no diff or still have a failing healthcheck.');
  process.exit(1);
}

main();
#!/usr/bin/env node
import { execSync } from 'child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exitCode = 1;
    throw err;
  }
}

try {
    console.log("Running healthcheck...");
    run('npm run build');
    run('npx eslint .');
    run('npx vitest run');
    console.log("Healthcheck passed.");
} catch(e) {
    process.exitCode = 1;
}

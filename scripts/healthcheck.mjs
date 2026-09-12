#!/usr/bin/env node
import { execSync } from 'child_process';
function runCheck(name, cmd) {
  try { execSync(cmd, { stdio: 'pipe' }); return true; }
  catch (error) {
    console.error(`Error in ${name}:`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}
let allPassed = runCheck('lint', 'npx eslint .') && runCheck('build', 'npm run build') && runCheck('test', 'npx vitest run');
if (!allPassed) process.exit(1);
process.exit(0);

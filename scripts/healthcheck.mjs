#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const mode = process.argv[2] || 'post';
const logFile = `healthcheck-${mode}.log`;
fs.writeFileSync(logFile, '');

function runCmd(cmd, desc) {
  try {
    console.log(`Running ${desc}...`);
    fs.appendFileSync(logFile, `Running ${desc}...\n`);
    const out = execSync(cmd, { stdio: 'pipe' });
    fs.appendFileSync(logFile, out);
    return true;
  } catch (e) {
    console.error(`Failed ${desc}`);
    fs.appendFileSync(logFile, `Failed ${desc}\n${e.stdout || ''}\n${e.stderr || ''}\n`);
    return false;
  }
}
let passed = true;
passed = runCmd('npx eslint .', 'Linting') && passed;
passed = runCmd('npx tsc --noEmit', 'Typechecking') && passed;
passed = runCmd('npx vitest run', 'Tests') && passed;
passed = runCmd('npm run build', 'Build') && passed;
if (!passed) { console.error("Healthcheck failed!"); process.exit(1); }
console.log("Healthcheck passed!"); process.exit(0);

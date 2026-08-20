#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function runCheck(name, command) {
  try {
    execSync(command, { stdio: 'pipe', cwd: projectRoot });
    return true;
  } catch (error) {
    console.error(`[Healthcheck] ${name} failed:`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

let ok = true;
ok = runCheck('build', 'npm run build') && ok;
ok = runCheck('test', 'npx vitest run') && ok;
ok = runCheck('lint', 'npx eslint .') && ok;

if (!ok) {
  process.exit(1);
}
process.exit(0);
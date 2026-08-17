#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

console.log('Running healthcheck...');

// Detect project structure dynamically
const isNodeProject = fs.existsSync(path.join(process.cwd(), 'package.json'));
if (!isNodeProject) {
  console.error('package.json not found. Assuming not in project root.');
  process.exit(1);
}

let ok = true;
console.log('--- Linting ---');
ok = run('npx eslint .') && ok;
console.log('--- Type checking / Build ---');
ok = run('npm run build') && ok;
console.log('--- Tests ---');
ok = run('npx vitest run') && ok;

if (ok) {
  console.log('Healthcheck passed!');
  process.exit(0);
} else {
  console.error('Healthcheck failed!');
  process.exit(1);
}

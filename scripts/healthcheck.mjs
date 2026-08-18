#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function main() {
  let success = true;

  const hasSrc = fs.existsSync('src');
  if (!hasSrc) {
     console.error("src directory not found");
     process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (pkg.scripts && pkg.scripts.build) {
     if (!run('npm run build')) success = false;
  }

  if (pkg.devDependencies && pkg.devDependencies.vitest) {
      if (!run('npx vitest run')) success = false;
  }

  process.exit(success ? 0 : 1);
}

main();

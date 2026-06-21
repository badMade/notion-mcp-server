#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function runCommand(command, errorMessage) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ Error: ${errorMessage}`);
    process.exit(1);
  }
}

console.log('--- Starting Healthcheck ---');

// 1. Lint
runCommand('npx eslint .', 'Linting failed.');

// 2. Typecheck
runCommand('npx tsc --build', 'Typechecking failed.');

// 3. Tests
// Vitest with --passWithNoTests to prevent failure if no test files are run
runCommand('npx vitest run --passWithNoTests --exclude "**/parser.test.*" --exclude "**/http-client-upload.test.*" --exclude "**/http-client.integration.test.*"', 'Tests failed.');

// 4. Build (the build script uses tsc -build and esbuild)
runCommand('npm run build', 'Build failed.');

console.log('\n✅ Healthcheck passed!');
process.exit(0);

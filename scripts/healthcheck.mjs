#!/usr/bin/env node
import { execSync } from 'child_process';

const runCommand = (command, errorMessage) => {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n❌ Error: ${errorMessage}`);
    process.exit(1);
  }
};

console.log('--- Running Healthcheck ---');

// 1. Build
runCommand('npx tsc --build', 'TypeScript build failed.');

// 2. Lint
runCommand('npx eslint .', 'Linting failed.');

// 3. Test
runCommand('npx vitest run --passWithNoTests --exclude \'**/parser.test.*\' --exclude \'**/http-client-upload.test.*\' --exclude \'**/http-client.integration.test.*\'', 'Tests failed.');

console.log('\n✅ Healthcheck passed!');
process.exit(0);

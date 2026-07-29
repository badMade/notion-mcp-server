#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Helper to run a command and return output, ignoring errors
function runCommand(command, ignoreError = false) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: REPO_ROOT });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
    }
    return false;
  }
}

function checkHealth() {
  console.log('\\n--- Running Healthcheck ---');
  return runCommand('node scripts/healthcheck.mjs', true);
}

function hasDiff() {
  try {
    const status = execSync('git status --porcelain', { cwd: REPO_ROOT }).toString().trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
}

function evaluateState() {
  const isHealthy = checkHealth();
  const diffExists = hasDiff();

  if (isHealthy && diffExists) {
    console.log('\\n✅ System is healthy and a repair diff was generated. Exiting 0.');
    process.exit(0);
  } else if (isHealthy && !diffExists) {
    console.log('\\n✅ System is healthy, but no diff was generated. Continuing...');
    return false; // Continue to next step
  } else {
    console.log('\\n❌ System is still unhealthy. Continuing to next step...');
    return false; // Continue to next step
  }
}

function main() {
  console.log('Starting self-heal pipeline...');

  const steps = [
    {
      name: 'Step 1: Rebuild/reinstall (clean install of tooling + deps)',
      run: () => runCommand('npm ci')
    },
    {
      name: 'Step 2: Lint/format auto-fix',
      run: () => {
        // Run eslint if available, otherwise just format
        try {
          execSync('npx eslint --fix .', { stdio: 'ignore', cwd: REPO_ROOT });
        } catch (e) {
          // ignore
        }
        runCommand('npx prettier -w .');
      }
    },
    {
      name: 'Step 3: Snapshot/generated updates',
      run: () => runCommand('npx vitest run -u --passWithNoTests')
    },
    {
      name: 'Step 4: Type stubs/analyzer config',
      run: () => runCommand('npm install')
    },
    {
      name: 'Step 5: Dependency re-resolve',
      run: () => runCommand('npm update')
    },
    {
      name: 'Step 6: Static asset regeneration',
      run: () => {
        // Build script might regenerate some assets
        runCommand('npm run build');
      }
    }
  ];

  for (const step of steps) {
    console.log(`\\n=== ${step.name} ===`);
    step.run();
    if (evaluateState()) {
       // Should have exited 0 already in evaluateState
    }
  }

  // If we exhausted all steps and still aren't healthy + diff
  console.log('\\n❌ Self-heal pipeline completed but did not find a working repair.');
  process.exit(1);
}

main();

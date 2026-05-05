import { execSync } from 'child_process';

function runCmd(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function runHealthcheck() {
  console.log("Running healthcheck...");

  // 1. Check build
  console.log("Building project...");
  const buildSuccess = runCmd('npm run build');
  if (!buildSuccess) return false;

  // 2. Check tests (allowing for no tests found depending on vitest config)
  console.log("Running tests...");
  const testSuccess = runCmd('npx vitest run --passWithNoTests');
  if (!testSuccess) return false;

  // 3. (Optional) types/lint checks can go here if part of healthcheck,
  // but build/test covers the primary gates for this JS project.

  return true;
}

const success = runHealthcheck();

if (success) {
  console.log("Healthcheck passed.");
  process.exit(0);
} else {
  console.error("Healthcheck failed.");
  process.exit(1);
}

#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Starting Self-Heal Pipeline...');

const runCommand = (command, name) => {
  console.log(`\n=== Step: ${name} ===`);
  console.log(`Executing: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.warn(`⚠️ Step "${name}" failed. Continuing to next step...`);
    return false;
  }
};

const checkHealth = () => {
  console.log('\n--- Running Post-Step Healthcheck ---');
  try {
    execSync('node scripts/healthcheck.mjs', { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
};

const checkDiff = () => {
  try {
    const status = execSync('git status --porcelain').toString().trim();
    return status.length > 0;
  } catch (e) {
    return false;
  }
};

const evaluateSuccess = () => {
  const isHealthy = checkHealth();
  const hasDiff = checkDiff();
  if (isHealthy && hasDiff) {
    console.log('✅ Healthcheck passed and diff detected. Exiting with 0 to trigger PR.');
    process.exit(0);
  } else if (isHealthy && !hasDiff) {
    console.log('ℹ️ Healthcheck passed but no diff detected. Continuing...');
  } else {
    console.log('❌ Healthcheck failed after step. Continuing...');
  }
};

const isNode = fs.existsSync('package.json');
const isPython = fs.existsSync('setup.py') || fs.existsSync('pyproject.toml') || fs.existsSync('requirements.txt');
const isGo = fs.existsSync('go.mod');
const isDotNet = fs.readdirSync('.').some(f => f.endsWith('.csproj'));
const isJava = fs.existsSync('pom.xml');

// Step 1: Rebuild/reinstall
if (isNode) runCommand('npm ci || npm install', 'Reinstall Dependencies');
else if (isPython) runCommand('pip install -e .', 'Reinstall Dependencies');
else if (isGo) runCommand('go mod download', 'Reinstall Dependencies');
else if (isJava) runCommand('mvn clean install -DskipTests', 'Reinstall Dependencies');
else if (isDotNet) runCommand('dotnet restore', 'Reinstall Dependencies');
evaluateSuccess();

// Step 2: Lint/format auto-fix
if (isNode) runCommand('npx eslint --fix src/ scripts/ && npx prettier -w .', 'Lint/Format');
else if (isPython) runCommand('ruff check --fix && ruff format', 'Lint/Format');
else if (isGo) runCommand('golangci-lint run --fix && go fmt ./...', 'Lint/Format');
else if (isJava) runCommand('mvn fmt:format', 'Lint/Format');
else if (isDotNet) runCommand('dotnet format', 'Lint/Format');
evaluateSuccess();

// Step 3: Snapshot/generated updates
if (isNode) runCommand('npx vitest run -u --passWithNoTests || npx jest --updateSnapshot', 'Update Snapshots');
else if (isPython) runCommand('pytest --snapshot-update', 'Update Snapshots');
else if (isDotNet) runCommand('dotnet test --update-snapshots', 'Update Snapshots');
evaluateSuccess();

// Step 4: Type stubs/analyzer config
if (isNode) runCommand('npx typesync', 'Typesync');
else if (isPython) runCommand('pip install types-requests types-PyYAML types-beautifulsoup4 types-Pillow', 'Type Stubs');
evaluateSuccess();

// Step 5: Dependency re-resolve
if (isNode) runCommand('npm update', 'Dependency Update');
else if (isPython) runCommand('pip-compile requirements.in -o requirements.txt', 'Dependency Update');
else if (isGo) runCommand('go mod tidy && go mod verify', 'Dependency Update');
else if (isJava) runCommand('mvn dependency:resolve -U', 'Dependency Update');
else if (isDotNet) runCommand('dotnet add package --update-all', 'Dependency Update');
evaluateSuccess();

// Step 6: Static asset regeneration
if (fs.existsSync('scripts/update_docs.py')) runCommand('python scripts/update_docs.py', 'Asset Gen (Docs)');
if (fs.existsSync('scripts/generate_badges.py')) runCommand('python scripts/generate_badges.py', 'Asset Gen (Badges)');
if (isGo && execSync('grep -r "go:generate" . || true').toString().trim()) runCommand('go generate ./...', 'Go Generate');
evaluateSuccess();

console.log('\n❌ All repair steps completed but failed to produce a healthy state with diff.');
process.exit(1);

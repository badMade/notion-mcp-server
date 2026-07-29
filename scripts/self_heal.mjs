#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const healthcheckScript = path.join(__dirname, 'healthcheck.mjs');

// Set working directory to project root
process.chdir(projectRoot);

const runHealthcheck = () => {
  try {
    execSync(`node ${healthcheckScript}`, { stdio: 'inherit', env: process.env });
    return true; // Healthcheck passed
  } catch (error) {
    return false; // Healthcheck failed
  }
};

const hasDiff = () => {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (!status) return false;

    // Check if unauthorized files were modified
    const lines = status.split('\n');
    for (const line of lines) {
      const file = line.substring(3).trim();
      if (file.includes('.github/workflows/ci.yml') || file.includes('.env') || file.includes('secrets/')) {
        console.error(`❌ Validation failed: Modification of restricted file detected -> ${file}`);
        return false;
      }
    }

    // Check for secrets/entropy in diff
    const diff = execSync('git diff', { encoding: 'utf-8' });
    const secretPatterns = [/ghp_[a-zA-Z0-9]{36}/, /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, /AKIA[0-9A-Z]{16}/];
    for (const pattern of secretPatterns) {
      if (pattern.test(diff)) {
         console.error(`❌ Validation failed: Potential secret exposed in diff.`);
         return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error checking git status:", error);
    return false;
  }
};

const cleanupStalePRs = () => {
  try {
    console.log("Cleaning up stale selfheal PRs...");
    const prsJson = execSync('gh pr list --label self-heal --state open --json number,createdAt', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const prs = JSON.parse(prsJson);
    const now = new Date();
    for (const pr of prs) {
       const created = new Date(pr.createdAt);
       const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
       if (diffHours > 24) { // Stale threshold: 24 hours
          console.log(`Closing stale PR #${pr.number}...`);
          execSync(`gh pr close ${pr.number} -c "Auto-closing stale self-heal PR"`);
       }
    }
  } catch (err) {
    console.warn("Could not cleanup stale PRs. (Skipping)");
  }
};

const repairSteps = [
  { name: 'Clean Install', cmd: 'npm ci' },
  { name: 'Format (Prettier)', cmd: 'npx prettier -w . "!**/.github/workflows/ci.yml" "!**/.env" "!**/secrets/**"' },
  { name: 'Update Test Snapshots', cmd: 'npx vitest run -u' },
  { name: 'Install Missing Types (type-sync placeholder)', cmd: 'echo "No missing types mechanism setup initially"' },
  { name: 'Update Dependencies', cmd: 'npm update' },
  { name: 'Asset Regeneration (placeholder)', cmd: 'echo "No assets to regenerate"' }
];

console.log("Starting Self-Heal Pipeline...");
cleanupStalePRs();

for (let i = 0; i < repairSteps.length; i++) {
  const step = repairSteps[i];
  console.log(`\n--- Repair Step ${i + 1}: ${step.name} ---`);

  try {
    console.log(`Running: ${step.cmd}`);
    execSync(step.cmd, { stdio: 'inherit', env: process.env });

    console.log(`\nVerifying step ${i + 1} with healthcheck...`);
    const passed = runHealthcheck();

    if (passed) {
      if (hasDiff()) {
         console.log(`\n✅ Step ${i + 1} succeeded. Healthcheck passed and meaningful diff produced.`);
         process.exit(0);
      } else {
         console.log(`\n✅ Step ${i + 1} succeeded. Healthcheck passed but NO diff produced. Continuing...`);
      }
    } else {
      console.log(`\n❌ Healthcheck failed after Step ${i + 1}. Proceeding to next step...`);
    }

  } catch (error) {
    console.error(`\n❌ Repair Step ${i + 1} encountered an error. Proceeding to next step...`);
  }
}

// If we got here, we either passed with no diffs, or failed everything.
if (runHealthcheck()) {
   console.log("\n✅ Self-heal complete: all passed, but no changes needed.");
   process.exit(1); // Exit 1 to indicate no PR needed (since we only exit 0 on pass + diff)
} else {
   console.log("\n❌ Self-heal exhausted all steps and healthcheck still fails.");
   process.exit(1);
}

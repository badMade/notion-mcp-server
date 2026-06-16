#!/usr/bin/env node

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

function runCommand(command, name) {
  console.log(`\n--- Running Repair Step: ${name} ---`);
  try {
    execSync(command, { stdio: "inherit", cwd: rootDir });
    return true;
  } catch (error) {
    console.error(`Repair step failed: ${name}`);
    return false;
  }
}

function runHealthcheck() {
  console.log("\n--- Running Healthcheck ---");
  try {
    execSync("node scripts/healthcheck.mjs", {
      stdio: "inherit",
      cwd: rootDir,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync("git status --porcelain", {
      encoding: "utf8",
      cwd: rootDir,
    });
    return diff.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function main() {
  console.log("Starting Self-Heal Pipeline...");

  const steps = [
    { name: "Rebuild/Reinstall", command: "npm ci" },
    {
      name: "Lint/Format Auto-Fix",
      command: "npx eslint --fix . && npx prettier -w .",
    },
    {
      name: "Snapshot Regeneration",
      command: "npx vitest run -u --passWithNoTests",
    },
    {
      name: "Type Stubs",
      command: "npx typesync || true"
    },
    { name: "Dependency Re-resolve", command: "npm update" },
    {
      name: "Static Asset Regeneration",
      command: "npm run docs:gen || true" // Placeholder for docs gen if it exists
    }
  ];

  for (const step of steps) {
    runCommand(step.command, step.name);

    const isHealthy = runHealthcheck();

    if (isHealthy) {
      if (hasDiff()) {
        console.log(
          `\n✅ Healthy state reached with diff after ${step.name}. Exiting 0.`,
        );
        process.exit(0);
      } else {
        console.log(
          `\n⚠️ Healthy state reached but NO DIFF after ${step.name}. Continuing to next step...`,
        );
        continue;
      }
    } else {
      console.log(
        `\n❌ Still unhealthy after ${step.name}. Continuing to next step...`,
      );
    }
  }

  console.log(
    "\n❌ Self-Heal Pipeline exhausted. Could not reach healthy state with diff.",
  );
  process.exit(1);
}

main();

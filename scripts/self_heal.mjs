#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command, logFile) {
  try {
    execSync(`${command} > ${logFile} 2>&1`, { stdio: "pipe" });
    return true;
  } catch (error) {
    return false;
  }
}

function hasDiff() {
  try {
    const diff = execSync("git status --porcelain", { encoding: "utf8" });
    return diff.trim().length > 0;
  } catch {
    return false;
  }
}

function healthcheck(logFile) {
  return run("node scripts/healthcheck.mjs", logFile);
}

function selfHeal() {
  console.log("Running self-heal pre-check...");
  const isHealthyPre = healthcheck("pre-check.log");
  if (isHealthyPre && !hasDiff()) {
    console.log("System is healthy and no diffs found. Exiting.");
    process.exit(1); // No action needed, intentional non-zero return for github actions workflow to catch
  }

  const steps = [
    { name: "Step 1: Rebuild/reinstall", command: "npm ci" },
    { name: "Step 2: Lint/format auto-fix", command: "npx eslint --fix . && npx prettier -w ." },
    { name: "Step 3: Snapshot updates", command: "npx vitest run -u --passWithNoTests" },
    { name: "Step 4: Type stubs", command: "npx typesync" },
    { name: "Step 5: Dependency re-resolve", command: "npm update" },
    { name: "Step 6: Static asset regeneration", command: "npm run build" }
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`Running ${step.name}...`);
    run(step.command, `repair-step-${i + 1}.log`);

    console.log(`Running healthcheck after ${step.name}...`);
    const isHealthy = healthcheck(`post-check-step-${i + 1}.log`);
    const diffExists = hasDiff();

    if (isHealthy && diffExists) {
      console.log(`Repair successful after ${step.name}. Found diff.`);
      process.exit(0);
    } else if (isHealthy && !diffExists) {
       console.log(`System healthy after ${step.name}, but no diff. Continuing...`);
       continue;
    } else {
      console.log(`Repair failed or system still unhealthy after ${step.name}. Continuing to next step...`);
    }
  }

  console.log("All repair steps attempted. System is still unhealthy or no fix was found.");
  process.exit(1);
}

selfHeal();
#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const HEALTHCHECK = path.join(process.cwd(), "scripts/healthcheck.mjs");

function hasDiff() {
    try {
        const status = execSync("git status --porcelain").toString().trim();
        return status.length > 0;
    } catch (e) {
        return false;
    }
}

function runHealthcheck() {
    try {
        execSync(`node ${HEALTHCHECK}`, { stdio: "inherit" });
        return true; // passed
    } catch (e) {
        return false; // failed
    }
}

function checkGate() {
    const passed = runHealthcheck();
    const diff = hasDiff();
    if (passed && diff) {
        console.log("Self-heal successful! Tests pass and changes exist.");
        process.exit(0);
    }
    return { passed, diff };
}

// Ensure clean status at start is logged
console.log("Starting self-heal pipeline...");

// Step 1: Rebuild/reinstall (clean install of tooling + deps)
console.log("--- Step 1: Clean Install ---");
try {
    execSync("npm ci", { stdio: "inherit" });
} catch (e) {
    console.warn("npm ci failed, falling back to npm install");
    try {
        execSync("npm install", { stdio: "inherit" });
    } catch (e2) {
        console.error("npm install also failed");
    }
}
checkGate();

// Step 2: Lint/format auto-fix
console.log("--- Step 2: Lint/Format Auto-fix ---");
try {
    execSync("npx prettier --write .", { stdio: "inherit" });
} catch (e) {
    console.error("Format step failed:", e.message);
}
checkGate();

// Step 3: Snapshot/generated updates
console.log("--- Step 3: Snapshot Updates ---");
try {
    execSync("npx vitest run -u --passWithNoTests", { stdio: "inherit" });
} catch (e) {
    console.error("Snapshot update failed:", e.message);
}
checkGate();

// Step 4: Type stubs/analyzer config
console.log("--- Step 4: Type Stubs ---");
// No generic typesync natively without an extra dep, but typescript build does basics
try {
    execSync("npx tsc --noEmit || true", { stdio: "inherit" });
} catch (e) {
    console.error("Type check step failed:", e.message);
}
checkGate();

// Step 5: Dependency re-resolve (lockfile refresh)
console.log("--- Step 5: Lockfile Refresh ---");
try {
    execSync("npm update", { stdio: "inherit" });
} catch (e) {
    console.error("npm update failed:", e.message);
}
checkGate();

// Step 6: Static asset regeneration
console.log("--- Step 6: Static Assets ---");
try {
    execSync("npm run build", { stdio: "inherit" });
} catch (e) {
    console.error("Build step failed:", e.message);
}
checkGate();

console.log("Self-heal pipeline completed. Final outcome:");
const finalStatus = checkGate();
console.log(`Healthcheck Passed: ${finalStatus.passed}`);
console.log(`Git Diff Exists: ${finalStatus.diff}`);

// Exit non-zero if no fix found
if (!finalStatus.passed || !finalStatus.diff) {
    console.error("Self-heal could not resolve the issue or produced no diff.");
    process.exit(1);
}

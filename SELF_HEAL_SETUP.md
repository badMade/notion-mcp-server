# Self-Heal Auto-Repair Configuration

This repository includes a fully autonomous, self-healing continuous integration and drift repair pipeline.

## Overview

The system consists of three main triggers:
1. **Scheduled:** Runs proactively based on a telemetry-derived schedule.
2. **Reactive:** Runs automatically when the main `ci` workflow fails.
3. **Manual:** Can be dispatched manually via GitHub Actions.

## Repair Pipeline

The automated repair process (`scripts/self_heal.mjs`) is completely idempotent and deterministic. It performs the following sequential actions:
1. **Rebuild/reinstall:** Runs a clean `npm ci`.
2. **Lint/format auto-fix:** Executes `npx prettier -w .` to fix code formatting drift.
3. **Snapshot/generated updates:** Updates test snapshots via `npx vitest run -u`.
4. **Type stubs/analyzer config:** Attempts to sync missing type definitions using `typesync`.
5. **Dependency re-resolve:** Refreshes the package lockfile via `npm update`.
6. **Static asset regeneration:** Triggers a fresh build of the application assets.

After each step, a strict healthcheck (`scripts/healthcheck.mjs`) executes. If the build becomes healthy *and* a relevant git diff is detected, the pipeline halts further repairs and proposes the changes.

## Self-Scheduling Logic

The proactive cadence adapts based on repository velocity. A dedicated workflow (`compute-schedule.yml`) periodically reads git telemetry (e.g., commit frequency) and adjusts the schedule for `self-heal.yml`.
This prevents noisy CI jobs during dormant periods and increases responsiveness during high-churn periods.

## Human Reviewer Checklist

When reviewing a self-heal pull request, please verify:
- [ ] No unintended source code logic was altered.
- [ ] The pipeline only modified formatting, lockfiles, snapshots, or auto-generated assets.
- [ ] No secrets or PII were accidentally exposed or committed.
- [ ] The PR addresses the underlying CI failure appropriately without masking an actual bug.

## Manual Override Instructions

If you need to force a specific schedule or disable the dynamic adjustment:
1. Edit `.github/self-heal-schedule.yml`.
2. Change the `schedule` cron value to your desired timing.
3. Ensure the `# AUTO-UPDATED` marker remains intact next to the cron string if you want dynamic updates to resume eventually. Remove the marker if you wish to freeze the schedule permanently.

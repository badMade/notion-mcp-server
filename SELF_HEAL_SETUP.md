# Self-Heal Automation Setup

This repository has been equipped with an automated self-healing pipeline designed by Claude Code / Jules.

## Overview
The self-healing workflow automatically detects drift or failures in CI and attempts to repair them using a universal, idempotent set of steps. If successful, it creates a Pull Request for human review.

## Triggers
The self-healing workflow (`self-heal.yml`) runs on three triggers:
1. **Scheduled**: Runs on an adaptive cron schedule computed based on repository telemetry (PR velocity, active periods, etc.).
2. **Reactive (CI Failure)**: Runs immediately if the main `ci` workflow fails on the default branch.
3. **Manual Dispatch**: Can be run manually via the GitHub Actions UI.

## Repair Pipeline
The pipeline runs through 6 idempotent steps. After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes AND there is a file diff, the script immediately exits and creates a PR.

The steps are:
1. **Rebuild/reinstall**: Clean install of tooling and dependencies (`npm ci`).
2. **Lint/format auto-fix**: Runs `eslint --fix` and `prettier -w`.
3. **Snapshot updates**: Runs tests and updates snapshots (`vitest run -u`).
4. **Type stubs**: Acquires missing type definitions (`typesync`).
5. **Dependency re-resolve**: Refreshes lockfile (`npm update`).
6. **Static asset regeneration**: Runs code generation/builds (`npm run build`).

## Self-Scheduling Logic
A separate workflow (`compute-schedule.yml`) runs periodically to adjust the scheduled cadence of the self-healing workflow.
- It calculates PR velocity.
- Adjusts the `cron` schedule dynamically.
- The state and rationale are saved in `.github/self-heal-schedule.yml`.

## Customization and Override
If you need to manually override the schedule, you can edit `.github/self-heal-schedule.yml` and commit it. The script has an oscillation guard, but manual changes are respected if needed.

## Reviewer Checklist
When reviewing a self-heal PR:
- Check the PR title to see what triggered it (Scheduled, Reactive, Manual).
- Ensure no unexpected files were modified (the pipeline has gates to prevent modifying `.env`, secrets, or core CI files).
- Review the uploaded logs (`pre-check.log`, `repair.log`, `post-check.log`) attached to the workflow run.
- Approve and merge if the fix looks correct.

# Self-Heal Auto-Repair Setup

This repository is configured with a self-adapting auto-repair pipeline. This pipeline automatically triggers fixes for code drift, formatting issues, missing types, and dependency drift, opening Pull Requests automatically for human review.

## Overview of Components

1. **`scripts/healthcheck.mjs`**: Validates project health (types, build, tests).
2. **`scripts/self_heal.mjs`**: Implements an idempotent auto-repair pipeline.
3. **`scripts/compute_schedule.mjs`**: Analyzes telemetry (commit/PR velocity) to dynamically compute the schedule.
4. **`.github/workflows/self-heal.yml`**: The main repair GitHub Action workflow.
5. **`.github/workflows/compute-schedule.yml`**: A periodic workflow that recomputes the active schedule based on actual project velocity.
6. **`.github/self-heal-schedule.yml`**: The config file that tracks the current computed schedule and rationale.

## Repair Pipeline Steps

The `self_heal.mjs` script performs the following steps idempotently:

1. **Rebuild/reinstall**: Runs `npm ci` to get a fresh dependency install.
2. **Lint/format auto-fix**: Formats the code using `prettier`.
3. **Snapshot/generated updates**: Updates test snapshots using `vitest -u`.
4. **Type stubs/analyzer config**: Runs `typesync` to fetch any missing `@types/*` dependencies.
5. **Dependency re-resolve**: Runs `npm update` to update packages according to lockfile rules.
6. **Static asset regeneration**: (Skipped by default unless configured).

After each step, the `healthcheck.mjs` is run. If the healthcheck passes AND there is a diff, the script immediately exits (0) and a PR is generated.

## Self-Scheduling

The system adjusts its run cadence based on recent activity:

- **High velocity** (>100 commits in 30 days): Every 4 hours
- **Active** (>50 commits): Every 8 hours
- **Standard** (>10 commits): Daily at midnight
- **Low-churn** (>0 commits): Weekly on Sunday
- **Dormant** (0 commits): Monthly on the 1st

### How to Override the Schedule

If you want to manually set the schedule instead of letting the system compute it automatically:
1. Open `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml`.
2. Modify the `cron` lines to your preferred interval.
3. Remove or alter the `# AUTO-UPDATED` comment so the `compute-schedule.yml` workflow does not overwrite it on the next run.
4. (Optional) Disable or remove `.github/workflows/compute-schedule.yml`.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check the trigger reason in the PR body (Scheduled vs Reactive vs Manual).
- [ ] Verify that only safe files were modified (e.g. no `.env`, no `.github/workflows/ci.yml` besides auto-update).
- [ ] Ensure any snapshot changes reflect intended behaviors rather than masking regressions.
- [ ] Check if new `@types` introduced by `typesync` are valid.

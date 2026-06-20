# Self-Healing Automation Setup

This repository contains an automated self-healing pipeline designed to detect code drift, run idempotent repair steps (such as formatting or dependency updates), and open a Pull Request for human review if fixes are found.

## Components

The automation consists of 8 primary deliverables:
1. **`scripts/healthcheck.mjs`**: Validates the codebase (lint, types, tests, build). Exits 0 on success, 1 on failure.
2. **`scripts/self_heal.mjs`**: Implements the idempotent 6-step repair pipeline. Executes a healthcheck after each step. Exits 0 only if a fix is successful and produces a git diff.
3. **`scripts/compute_schedule.mjs`**: Telemetry script that analyzes PR/commit velocity to compute the optimal cadence for proactive self-healing. Updates `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml` using `js-yaml`.
4. **`.github/workflows/self-heal.yml`**: Main GitHub Actions workflow. Handles 3 triggers: `schedule`, `workflow_run` (on CI failure), and `workflow_dispatch`. Includes gates for duplicate PRs, safety boundaries, and secrets scanning.
5. **`.github/workflows/compute-schedule.yml`**: Periodic workflow that recalculates the schedule based on recent activity.
6. **`.github/self-heal-schedule.yml`**: Metadata file storing the currently computed schedule and rationale. Contains an `# AUTO-UPDATED` marker for deterministic updates.
7. **Dependency Updates**: The `devDependencies` in `package.json` include `js-yaml`, `eslint`, `prettier`, and `typesync` for the repair and scheduling automation.
8. **This Setup Guide (`SELF_HEAL_SETUP.md`)**: Comprehensive documentation of the pipeline.

## Repair Pipeline

The self-healing script performs the following idempotent steps in order:
1. **Rebuild/reinstall**: Cleans dependencies using `npm ci`.
2. **Lint/format auto-fix**: Formats code using `npx eslint --fix .` and `npx prettier --write .`.
3. **Snapshot updates**: Updates testing snapshots using `npx vitest run -u --passWithNoTests`.
4. **Type stubs/analyzer config**: Fetches missing type definitions using `npx typesync`.
5. **Dependency re-resolve**: Standard minor/patch dependency update using `npm update`.
6. **Static asset regeneration**: Rebuilds outputs using `npm run build`.

After each step, a healthcheck is run. If the check passes *and* there is a meaningful file diff, the pipeline halts early, and the workflow creates a PR.

## Self-Scheduling Logic

To avoid unnecessary CI consumption, the proactive schedule adapts dynamically.

- **Telemetry**: `compute_schedule.mjs` checks `git rev-list` to determine activity over the last month.
- **Cadence Tiers**:
  - High Velocity (>50 commits/mo): Runs every 4 hours (`0 */4 * * *`)
  - Active Velocity (10-50 commits/mo): Runs twice daily (`0 8,20 * * *`)
  - Low/Dormant Velocity (<10 commits/mo): Runs once daily (`0 8 * * *`)
- **Oscillation Guard**: The recalculation avoids thrashing by requiring at least 3 days between schedule updates.

## Triggers

1. **Scheduled**: Runs proactively based on the calculated schedule. Creates a PR titled `[Self-Heal Scheduled] Drift fixes`.
2. **Reactive**: Runs immediately after the main `ci` workflow fails. Creates a PR titled `[Self-Heal Reactive] CI fix`.
3. **Manual**: Triggered manually via the GitHub Actions UI (`workflow_dispatch`). Creates a PR titled `[Self-Heal Manual] Repair`.

## How to Customize or Override

- **Modify Repair Steps**: Edit `scripts/self_heal.mjs` and adjust the `pipeline` array. Ensure the commands are strictly idempotent.
- **Adjust Healthcheck Checks**: Edit `scripts/healthcheck.mjs` to add or modify build commands, linter rules, or test exclusions.
- **Manual Schedule Override**:
  - To freeze the schedule, change the cron string directly in `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.
  - To prevent it from auto-updating again, you can disable the `compute-schedule.yml` workflow, or modify `scripts/compute_schedule.mjs`.

## Reviewer Checklist for Self-Healing PRs
- [ ] Check `repair-step-*.log` artifacts for context on what caused the drift.
- [ ] Ensure formatting/snapshot updates align with intent.
- [ ] Confirm no secrets or forbidden files were committed (enforced by the workflow gates, but double-check).
- [ ] Approve and merge.

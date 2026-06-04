# Self-Healing CI Pipeline Setup

This project is equipped with an automated self-healing CI pipeline that detects code drift, resolves common issues automatically, and submits Pull Requests for review.

## Architecture & Workflows

- **`.github/workflows/self-heal.yml`**: The primary pipeline that executes repair steps. It triggers on:
  - `schedule`: Periodically checks for drift.
  - `workflow_run`: Reactively attempts repairs if the main `ci` workflow fails.
  - `workflow_dispatch`: Manual trigger.
- **`.github/workflows/compute-schedule.yml`**: An adaptive scheduling workflow that monitors repository telemetry (commit frequency) and dynamically updates the schedule expression.

## Repair Steps (`scripts/self_heal.mjs`)

The self-heal script runs idempotently through the following sequence:

1. **Rebuild/reinstall**: Runs `npm ci` to ensure tooling and dependencies are intact.
2. **Lint & Format**: Runs `npx eslint --fix .` and `npx prettier -w .` to align code formatting to project standards.
3. **Snapshot Updates**: Runs `npx vitest run -u --passWithNoTests` to update test snapshots if they have drifted from implementation.
4. **Type Stubs**: Evaluates types, omitted when strict idempotency is required or typesync is unconfigured.
5. **Dependency Updates**: Safely updates minor/patch versions using `npm update`.
6. **Static Assets**: Regenerates files if generation scripts are detected.

After each step, `scripts/healthcheck.mjs` runs. If the project state becomes "healthy" (lint, build, tests pass) and there is a diff, the pipeline stops and proposes a PR immediately. If healthy but no files were modified, it continues trying subsequent steps.

## Self-Scheduling Logic

The `scripts/compute_schedule.mjs` determines the optimum check cadence based on recent PR and commit velocity:
- **High Activity**: Checks every 6 hours.
- **Active**: Checks every 12 hours.
- **Standard**: Checks daily.
- **Dormant**: Checks weekly.

### Manual Schedule Override

If you need to fix the schedule and stop the pipeline from recomputing it automatically:
1. Open `.github/self-heal-schedule.yml`.
2. Change `override: false` to `override: true`.
3. Adjust the `schedule` cron string manually.

## Reviewer Checklist

When a `[Self-Heal ...]` PR is opened, please:
1. Review the file diffs to ensure no logic was fundamentally altered.
2. Verify that CI passes on the self-healing branch.
3. Review the provided artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) linked in the PR description if anything seems incorrect.
4. Merge using standard procedures when ready.
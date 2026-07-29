# Self-Heal Automation Setup

This project uses a self-healing automation pipeline to detect drift, auto-repair configuration/formatting, and dynamically compute its own schedule.

## How it works

The pipeline operates in two main workflows:

1. **`self-heal.yml`**: The core repair loop. It handles scheduled, reactive (CI failure), and manual triggers.
2. **`compute-schedule.yml`**: A daily background task that adjusts the cadence of `self-heal.yml` based on repository telemetry (commit frequency/PR velocity).

### The Repair Pipeline

The script `scripts/self_heal.mjs` runs through 6 idempotent steps to attempt fixing the repository state. After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes and there is a diff, the repair stops and auto-generates a PR.

The order of steps is:
1. **Rebuild/reinstall**: Cleans dependencies and does a fresh build.
2. **Lint/format auto-fix**: Runs `eslint --fix` and `prettier -w`.
3. **Snapshot regeneration**: Runs test snapshot updates.
4. **Type stubs/analyzer config**: Refreshes types (if applicable).
5. **Dependency re-resolve**: Updates lockfile using standard tooling.
6. **Static asset regeneration**: Refreshes docs/code-gen (if applicable).

### Self-Scheduling Explanation

The `compute_schedule.mjs` script calculates the optimal cron schedule based on recent git history (commits in the last 30 days). It uses a 3-day oscillation guard to prevent thrashing.

- **High Churn** (>100 commits): Every 6 hours
- **Active** (>50 commits): Every 12 hours
- **Standard** (>10 commits): Daily
- **Low Churn** (>0 commits): Weekly
- **Dormant** (0 commits): Monthly

The computed schedule and rationale are saved in `.github/self-heal-schedule.yml`.

### Override Instructions

If you need to manually override the schedule, you can:
1. Update `.github/self-heal-schedule.yml` manually.
2. The oscillation guard will prevent the automation from overwriting your change for at least 3 days.

### Reviewer Checklist

When reviewing a PR opened by the self-healing bot:
- [ ] Check the trigger reason in the PR body.
- [ ] Ensure that only allowed files (`src/`, `tests/`, `scripts/`, `package.json`, etc.) were modified.
- [ ] Confirm no secrets or `.env` files were accidentally included.
- [ ] Review the Artifact logs attached to the Actions run if you need context on why a repair failed initially.

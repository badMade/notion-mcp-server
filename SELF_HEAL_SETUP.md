# Self-Heal Auto-Repair Setup

This repository contains an automated self-healing CI pipeline designed to fix codebase drift (linting, snapshots, types, dependencies).

## How it works

The pipeline consists of two GitHub Actions workflows:

1. **`self-heal.yml`**: Runs the actual repair pipeline.
2. **`compute-schedule.yml`**: Periodically analyzes repository telemetry to calculate the optimal run schedule for `self-heal.yml`.

### Triggers

The self-healing pipeline triggers in three ways:
* **Scheduled**: Runs on a cadence determined by telemetry (e.g. daily, weekly).
* **Reactive**: Triggers whenever the main `ci` workflow fails.
* **Manual**: Can be triggered manually via workflow_dispatch.

### Repair Pipeline Steps

The `scripts/self_heal.mjs` script performs an idempotent 6-step repair process:
1. **Rebuild/Reinstall**: Clean install of dependencies (`npm ci`).
2. **Lint/Format Auto-fix**: Runs `eslint --fix` and `prettier -w`.
3. **Snapshot Updates**: Updates test snapshots using `vitest run -u`.
4. **Type Stubs**: Syncs missing types using `typesync`.
5. **Dependency Refresh**: Resolves package updates using `npm update`.
6. **Static Asset Regeneration**: Standard build process (`npm run build`).

If any step fixes the build and produces a `git diff`, the script exits successfully, and a PR is automatically generated.

## Scheduling Logic

The schedule is self-adapting. `scripts/compute_schedule.mjs` analyzes the PR and commit velocity over the last 30 days:
* **High Velocity**: Runs every 6 hours.
* **Active Velocity**: Runs every 12 hours.
* **Standard**: Runs daily.
* **Low Churn**: Runs twice a week.
* **Dormant**: Runs weekly.

### Manual Override

To manually override the schedule and prevent the system from changing it back immediately:
1. Edit `.github/self-heal-schedule.yml`.
2. Update the `SCHEDULE` property to your desired cron string.
3. Update `LAST_UPDATED` to the current time.
4. Manually update `.github/workflows/self-heal.yml` to match the cron string (ensuring the `# AUTO-UPDATED` comment remains).

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check the `pre-check.log`, `repair.log`, and `post-check.log` uploaded as artifacts.
- [ ] Verify the diff only contains expected fixes (e.g. formatting, snapshot updates, lockfile updates).
- [ ] Ensure no logical code changes were made by the agent.
- [ ] Ensure no secrets or API keys are present in the diff.

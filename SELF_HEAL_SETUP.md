# Self-Heal Coding Automation

This repository incorporates an automated self-healing CI pipeline designed to detect code drift, repair routine issues (linting, snapshot updates, deps re-resolution), and autonomously open pull requests for human review.

## Architecture

The system consists of three main parts:
1. **Healthcheck (`scripts/healthcheck.mjs`)**: The strict gatekeeper. It runs linting, type checks, build, and specific safe tests. If the build does not pass after a repair attempt, the change is rejected.
2. **Repair Pipeline (`scripts/self_heal.mjs`)**: A deterministic, 6-step idempotent pipeline:
   - Rebuild/Reinstall
   - Lint/Format auto-fix
   - Snapshot regeneration
   - Type stubs/analyzer config verification
   - Dependency re-resolve
   - Static asset regeneration
3. **Adaptive Scheduling (`scripts/compute_schedule.mjs`)**: Automatically computes the ideal schedule cron interval based on repository telemetry (PR velocity, commit volume) to prevent thrash or idle compute waste.

## Triggers

1. **Scheduled**: Periodically runs based on the dynamically computed cadence (stored in `.github/self-heal-schedule.yml`).
2. **Reactive**: Automatically triggered on any `workflow_run` of the main CI that results in a failure.
3. **Manual**: Can be triggered manually via `workflow_dispatch` on the GitHub Actions UI.

## How to Override the Schedule

If you wish to manually override the computed schedule and prevent the auto-scheduler from changing it back:
1. Edit `.github/self-heal-schedule.yml`
2. Change your cron expression in `schedule`.
3. Set `override: true` to prevent future programmatic overwrites.

## Reviewer Checklist

When reviewing a PR opened by `github-actions[bot]`:
- Ensure the PR only contains changes from allowed locations (`src/`, `tests/`, `scripts/`, `package*.json`, `eslint.config.mjs`).
- Ensure no sensitive credentials/tokens were included.
- Review the `repair.log` and `healthcheck.log` attached as artifacts to the GitHub Actions run for the PR.

# Self-Heal Setup

This repository has a self-healing pipeline configured to run automatically to repair CI failures and configuration drift.

## Triggers
1. **Scheduled**: Computed dynamically based on repo telemetry (commit/PR velocity).
2. **CI Failure**: Runs reactively if the main `ci` workflow fails.
3. **Manual**: Can be dispatched manually via GitHub Actions.

## The Pipeline
The pipeline runs idempotently in this order:
1. Reinstall dependencies
2. Lint/format with auto-fix
3. Update snapshots
4. Sync types
5. Update dependencies
6. Rebuild assets

If a diff is generated that passes all healthchecks and security gates (no secrets, valid boundaries), a PR is automatically opened for human review.

## Scheduling Rationale
The pipeline determines its own optimal frequency.
- High churn repos run frequently (every few hours).
- Dormant repos run infrequently (weekly).

This schedule is output to `.github/self-heal-schedule.yml` and tracked via telemetry.

## Manual Overrides
To force a specific schedule:
1. Edit `.github/self-heal-schedule.yml` and update the cron expression.
2. Edit `.github/workflows/self-heal.yml` to match.
3. Commit and merge the changes. The `compute-schedule` pipeline will respect user changes if necessary but may override them when the repository cadence fundamentally shifts.

# Self-Heal Coding Agent Setup

This repository uses a self-healing pipeline to auto-repair formatting, linting, and minor drifts.

## Triggers
- **Scheduled**: Runs automatically based on a dynamically computed schedule.
- **Reactive**: Runs when the `ci` or `pr-review` workflows fail on default branches.
- **Manual**: Can be triggered manually via `workflow_dispatch`.

## Repair Pipeline Steps
1. Reinstall dependencies
2. Lint & format auto-fix
3. Vitest snapshot update
4. Missing type stubs sync
5. Lockfile refresh
6. Build asset regeneration

## Schedule Recomputation
A separate `compute-schedule.yml` workflow periodically looks at PR merge activity and adjusts the cron schedule automatically to match the repo's activity level.

## Overriding Schedule
To manually set the schedule, edit `.github/self-heal-schedule.yml` and the cron line in `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- Review any opened `selfheal-*` PRs for correctness.
- Check that test snapshots were not updated erroneously.

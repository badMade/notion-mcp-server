# Self-Heal Pipeline

This repository includes a self-healing automation pipeline that repairs CI failures and code drift proactively.

## Triggers
1. **Scheduled Run**: Adapts based on project activity.
2. **CI Failure**: Runs reactively if the main `ci` workflow fails.
3. **Manual Dispatch**: Can be run ad-hoc from the Actions tab.

## Self-Scheduling
The schedule is continuously optimized via `compute-schedule.yml` which observes commit frequency and adjusts active run windows to match peak hours.

## Repair Pipeline (6 Steps)
1. Reinstall dependencies
2. Lint auto-fix
3. Snapshot updates
4. Type stub syncing
5. Dependency upgrades
6. Static asset regeneration

## Reviewer Checklist
- Check for unintended logic changes.
- Ensure only generated/formatting code is modified.
- Do not commit secrets.

## Overrides
To override the schedule manually, edit `.github/self-heal-schedule.yml` and adjust the cron expression. Ensure the `# AUTO-UPDATED` marker is present in `.github/workflows/self-heal.yml` to allow script to detect it in the future.

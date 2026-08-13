# Self-Heal Pipeline Setup

This pipeline consists of three triggers (scheduled, CI failure, manual) to auto-repair the codebase (formatting, dependencies, types, snapshots).

## Repair Steps
1. Reinstall dependencies
2. Run linter and formatter
3. Update snapshots
4. Sync types
5. Re-resolve dependencies
6. Static assets update

## Scheduling
The schedule is self-computing based on telemetry. Override `.github/self-heal-schedule.yml` directly if you want manual control.

## Checklist for Reviewers
- Check changes before merging selfheal PRs.

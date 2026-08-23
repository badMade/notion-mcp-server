# Self-Heal Automation Setup

This repository is equipped with a self-adapting repair pipeline.

## Repair Pipeline Steps
1. Rebuild/reinstall dependencies.
2. Lint auto-fix and format.
3. Update test snapshots.
4. Sync missing type stubs.
5. Refresh lockfile.
6. Build artifacts.

## Self-Scheduling Logic
The `compute-schedule.yml` workflow periodically analyzes PR and CI telemetry to compute an optimal run frequency. It updates `self-heal-schedule.yml` accordingly.

## Overrides
To manually override, edit `.github/self-heal-schedule.yml` directly.

## Reviewer Checklist
- Verify no logic changes were introduced.
- Review artifact logs linked in the PR.
- Ensure no sensitive data is in the diff.
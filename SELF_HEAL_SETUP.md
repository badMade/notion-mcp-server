# Self-Heal Automation Setup

This repository uses an automated self-healing CI pipeline.

## Triggers
1. **Scheduled**: Runs periodically based on project velocity.
2. **CI Failure**: Runs reactively if the main CI workflow fails.
3. **Manual**: Can be triggered manually via workflow dispatch.

## Repair Pipeline
1. Install dependencies
2. Lint and format
3. Update snapshots
4. Sync types
5. Resolve lockfile
6. Build artifacts

## Telemetry & Scheduling
The `compute-schedule.yml` workflow periodically checks git velocity and adjusts the `self-heal.yml` schedule expression automatically.

## Override
To manually override, edit `.github/self-heal-schedule.yml` and the cron line in `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- Check artifact logs linked in the PR.
- Verify no secrets were committed.
- Verify only allowed files were modified.
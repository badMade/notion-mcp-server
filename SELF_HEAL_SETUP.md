# Self-Heal Coding Agent

This project includes an automated self-healing CI pipeline.

## Triggers
- **Scheduled**: Runs automatically on a telemetry-derived cadence (see `.github/self-heal-schedule.yml`).
- **CI Failure**: Runs reactively if the main `ci` workflow fails.
- **Manual**: Can be triggered manually via workflow dispatch.

## Repair Pipeline
1. Rebuild/reinstall (clean install of tooling + deps)
2. Lint/format auto-fix
3. Snapshot/generated updates
4. Type stubs/analyzer config
5. Dependency re-resolve
6. Static asset regeneration

## Schedule Updates
A separate workflow evaluates repo activity and adjusts the cron schedule automatically via PR.

## Override
To override the schedule, manually edit `.github/self-heal-schedule.yml` and the corresponding cron line in `.github/workflows/self-heal.yml`.

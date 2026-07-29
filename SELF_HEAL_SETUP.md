# Self-Heal Setup

This project uses an automated self-healing pipeline designed to detect and repair common CI drift and failures.

## Components
1. **scripts/healthcheck.mjs**: Validates type stubs, linters, tests, and build.
2. **scripts/self_heal.mjs**: Runs idempotent repair steps (reinstall, lint-fix, snapshot-updates, typesync, dependeny updates, build).
3. **scripts/compute_schedule.mjs**: Telemetry script that analyzes git history to adapt scheduling based on activity.

## Triggers
- **Scheduled**: Computed via telemetry.
- **Reactive**: CI failures trigger auto-repair.
- **Manual**: Via workflow dispatch.

## Configuration
Edit `.github/self-heal-schedule.yml` to set custom schedules if necessary.

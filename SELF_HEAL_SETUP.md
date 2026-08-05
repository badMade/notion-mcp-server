# Self-Heal Setup

This project uses an automated self-healing CI pipeline that detects configuration drift and applies automated repairs.

## How it works

1. **Triggers:** The self-heal workflow can run on a computed schedule, when the `ci` workflow fails, or via manual dispatch.
2. **Repairs:** It attempts 6 idempotent repair steps (reinstall, lint/format, snapshot update, stubs, deps, assets) to establish a clean state.
3. **Validation:** If the healthcheck passes and there is a diff, it automatically creates a PR for review.
4. **Schedule:** The schedule is recomputed periodically via `scripts/compute_schedule.mjs` based on Git/GitHub telemetry (e.g. PR velocity).

## Overrides

To manually override the schedule, you can edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` to set your desired cron.
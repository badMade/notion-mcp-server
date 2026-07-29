# Self-Heal Automation Setup

This project uses a self-healing pipeline to automatically resolve CI drift, style issues, and dependency synchronization.

## How it Works

The pipeline is triggered in three ways:
1. **Scheduled:** Proactive self-repair running automatically based on project velocity.
2. **Reactive:** Triggers on `ci` workflow failure.
3. **Manual:** Can be run on demand via `workflow_dispatch`.

It runs a deterministic, idempotent repair pipeline:
1. **Rebuild/Reinstall:** Standardizes the environment.
2. **Lint/Format:** Fixes standard styling.
3. **Snapshots:** Updates tests and snapshots.
4. **Types:** Fetches necessary type definitions.
5. **Dependencies:** Re-resolves and updates packages safely.
6. **Assets:** Regenerates assets and verifies the build.

## Self-Scheduling

The schedule is adaptive. It uses GitHub Actions telemetry (`scripts/compute_schedule.mjs`) to monitor PR velocity and adjusts the cadence tier to avoid unnecessary runs during dormant periods and maximize utility during active ones.

The configuration lives in `.github/self-heal-schedule.yml`. If manually modified, the compute script will respect your override on the next scheduled run.

## Reviewer Checklist

When a PR titled `[Self-Heal*]` is opened:
- [ ] Review the artifact logs (attached to the action run).
- [ ] Ensure that only safe, expected changes are made.
- [ ] Merge if tests and healthchecks pass.

## Overrides

To modify the schedule, change `.github/self-heal-schedule.yml` directly or edit `.github/workflows/self-heal.yml`.

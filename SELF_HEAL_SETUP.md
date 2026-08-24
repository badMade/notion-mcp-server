# Self-Healing Pipeline Setup

This project uses an automated self-healing pipeline to fix CI failures and resolve code drift.

## Overview
The pipeline consists of:
1. **Healthcheck (`scripts/healthcheck.mjs`)**: Verifies lint, types, and tests pass.
2. **Repair Script (`scripts/self_heal.mjs`)**: Executes an idempotent 6-step repair sequence (install, lint, snapshot, typesync, deps, assets).
3. **Telemetry & Scheduling (`scripts/compute_schedule.mjs`)**: Periodically recomputes the ideal schedule for running drift detection based on GitHub telemetry (PR velocity, active hours).

## Triggers
1. **Scheduled**: Runs on a dynamic schedule computed from repository telemetry to catch code drift.
2. **CI Failure**: Runs reactively whenever the primary CI workflow fails.
3. **Manual Dispatch**: Can be triggered manually via the Actions tab.

## Customization and Override
If you want to manually override the schedule, you can edit `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

## Reviewer Checklist
When reviewing a self-heal PR:
- [ ] Check the changed files are within the allowed scope.
- [ ] Ensure no secret or unintended configuration is modified.
- [ ] Verify the pipeline logs uploaded in the Actions artifacts if you need context on the fix.

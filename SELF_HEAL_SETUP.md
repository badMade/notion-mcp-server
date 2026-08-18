# Self-Heal Setup

This project uses a self-healing pipeline for automatic drift detection and repair.

## Triggers
- **Scheduled**: Runs dynamically based on repository cadence.
- **CI Failure**: Runs reactively upon failure of the `ci` workflow.
- **Manual**: Manually triggered via GitHub UI.

## Architecture
- `scripts/healthcheck.mjs`: Ensures project health before and after repair.
- `scripts/self_heal.mjs`: Implements idempotent repair steps (install, format, snapshot, etc.).
- `scripts/compute_schedule.mjs`: Computes the optimal run schedule based on commit telemetry.

## Schedule Override
Modify `.github/self-heal-schedule.yml` to adjust schedule. Ensure the `# AUTO-UPDATED` tag remains in `self-heal.yml`.

## Reviewer Checklist
- Confirm all repair steps passed in logs.
- Review diff to ensure no secrets or unintended logic changes are included.

# Self-Healing Pipeline Setup

This project utilizes an automated self-healing CI pipeline to detect codebase drift, correct formatting issues, update test snapshots, and ensure general codebase health.

## Triggers

1. **Scheduled**: Runs automatically based on a self-computed cadence (telemetry derived from commit frequency).
2. **Reactive**: Triggered by a failure in the main `ci` workflow to fix issues immediately.
3. **Manual**: Can be triggered manually via `workflow_dispatch` in GitHub Actions.

## How it works

- `scripts/healthcheck.mjs`: Verifies build output and test runs. Exits `0` on success and `1` on failure.
- `scripts/self_heal.mjs`: An idempotent script that reinstalls dependencies, fixes formatting via Prettier, and updates Vitest snapshots. If changes are detected and tests pass afterward, it exits `0`, signaling the pipeline to create a Pull Request.
- `scripts/compute_schedule.mjs`: Reads commit telemetry and adjusts the running frequency (e.g., from weekly to daily or hourly) based on how active the repository is. Updates `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml`.

## Overrides

To manually override the schedule, you can modify `.github/self-heal-schedule.yml`. Ensure the `# AUTO-UPDATED` tag remains in `.github/workflows/self-heal.yml` if you want future automated adjustments to continue working properly.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check if the changes only include formatting and snapshots (no source logic).
- [ ] Verify that no secrets or API keys have been accidentally committed.
- [ ] Ensure tests are passing.

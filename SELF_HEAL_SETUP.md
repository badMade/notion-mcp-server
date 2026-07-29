# Self-Heal Pipeline Setup and Architecture

This document describes the automated, self-adapting, self-healing CI pipeline configured for this repository.

## Components

1. **`scripts/healthcheck.mjs`**: Validates the codebase state via formatting checks, tests, and builds. Exits with 0 if healthy, or 1 if broken.
2. **`scripts/self_heal.mjs`**: Six idempotent steps applied in sequential order. Checks health after each step and cleanly exits with 0 if it repaired the codebase and generated a diff.
   - **Step 1**: Rebuild/Reinstall dependencies.
   - **Step 2**: Lint and format files auto-fix.
   - **Step 3**: Vitest snapshot updates.
   - **Step 4**: Fetch updated type stubs using `typesync`.
   - **Step 5**: Update dependencies.
   - **Step 6**: Run production build.
3. **`scripts/compute_schedule.mjs`**: Telemetry script calculating the optimal schedule depending on recent repository commit velocity.

## Triggers

The self-healing pipeline reacts to three primary events:
1. **Scheduled Runs:** Periodically evaluated via `.github/workflows/self-heal.yml`.
2. **Reactive (CI Failure):** Executes immediately after a `ci` workflow failure.
3. **Manual Dispatch:** Can be manually triggered from the Actions tab.

## Telemetry & Schedule Autonomics

The scheduled run's frequency is not hardcoded but dynamically adjusts based on Git commit frequency in the preceding week. The `compute-schedule.yml` workflow recalculates this weekly using `compute_schedule.mjs`, producing a Pull Request if the required cadence shifts due to project activity.

- **High Velocity (> 50 commits/wk):** Every 4 hours.
- **Active Velocity (> 20 commits/wk):** Every 8 hours.
- **Standard Velocity (> 5 commits/wk):** Twice daily.
- **Low-Churn (> 0 commits/wk):** Daily.
- **Dormant:** Weekly.

## Manual Overrides

If you need to manually enforce a schedule:
1. Open `.github/self-heal-schedule.yml`.
2. Modify the `schedule` variable to your desired Cron expression.
3. Update `.github/workflows/self-heal.yml` to match if the auto-update scripts were bypassing.

*Note: Ensure yaml is perfectly valid when modifying the metadata file, and avoid using raw `sed` across the files as the schedule mutator explicitly checks for a parseable round-trip state before replacing the `# AUTO-UPDATED` marker.*

## Reviewer Checklist

When reviewing a PR from this automation:
- Check that the PR modifies safe targets (e.g., formatting, snapshots, lockfiles) and doesn't inject logic changes.
- Verify `healthcheck` success on the PR artifact context.
- Keep in mind the bot will not merge automatically; a human reviewer is strictly required.

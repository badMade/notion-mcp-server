# Self-Heal Auto-Repair Configuration

This project includes an automated self-healing pipeline that detects code drift, resolves common CI failures, and creates PRs for manual review.

## Pipeline Steps
The pipeline is entirely idempotent and runs the following steps sequentially in `scripts/self_heal.mjs`:
1. **Rebuild/reinstall**: Ensures a clean installation of tooling and dependencies.
2. **Lint/format auto-fix**: Runs `eslint --fix` to address stylistic and minor linting errors.
3. **Snapshot/generated updates**: Runs `vitest run -u` to update test snapshots if they differ from the output.
4. **Type stubs/analyzer config**: Runs `typesync` and re-installs to acquire missing type definitions.
5. **Dependency re-resolve**: Runs `npm update` to bump lockfile resolutions.
6. **Static asset regeneration**: Runs `npm run build` to output fresh built files.

If a healthcheck passes AND a valid git diff is produced at any step, the script succeeds and exits immediately, skipping the remaining steps.

## Self-Scheduling Mechanism
The execution cadence is computed by `scripts/compute_schedule.mjs`, which runs on its own schedule (via `.github/workflows/compute-schedule.yml`).
It calculates the PR merge frequency (telemetry) over a rolling 30-day window and dynamically adjusts the cron expression in `.github/workflows/self-heal.yml`.
The current schedule and rationale are saved in `.github/self-heal-schedule.yml`.

## Reviewer Checklist
When a Self-Heal PR is created, humans must still review the changes before merging. Consider:
- Did the pipeline introduce a real bug fix or only format fixes?
- Did snapshots update properly? Check for regression logic.
- Ensure that no secrets or API keys have been accidentally committed (the pipeline prevents this, but humans are the final check).

## Manual Overrides
To override the schedule manually:
1. Edit `.github/self-heal-schedule.yml` with your desired cron expression.
2. Ensure you modify the `# AUTO-UPDATED` line in `.github/workflows/self-heal.yml` to match.
3. Update `last_updated` in the yaml file to a future date to prevent the `compute-schedule` workflow from immediately overwriting it.

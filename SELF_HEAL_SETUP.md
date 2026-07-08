# Self-Healing Pipeline Setup

This project uses an automated self-healing pipeline designed to detect and auto-repair drift, code formatting issues, generated artifacts, and types.

## Architecture

The system consists of the following components:
1. `scripts/healthcheck.mjs`: A strict gatekeeper that verifies the health of the project (linting, tests, types).
2. `scripts/self_heal.mjs`: An idempotent repair script that executes the 6 repair steps and exits successfully only if healthcheck passes and diff exists.
3. `scripts/compute_schedule.mjs`: A script that runs periodically to evaluate project telemetry (merge rate) and adapt the background drift-fixing schedule.
4. `.github/workflows/self-heal.yml`: The primary GitHub Action that runs the repair pipeline.
5. `.github/workflows/compute-schedule.yml`: The GitHub Action that handles self-scheduling adaptation.
6. `.github/self-heal-schedule.yml`: Holds the current schedule state and telemetry rationale.

## Triggers

The self-healing pipeline triggers via:
1. **Scheduled (Proactive)**: Runs periodically based on a dynamic schedule adapted to PR churn.
2. **CI Failure (Reactive)**: If the main `ci` workflow fails on the default branch.
3. **Manual Dispatch**: Can be run manually via GitHub Actions.

## Repair Steps

1. **Rebuild/reinstall**: Cleans dependencies to ensure clean slate (`npm ci`).
2. **Lint/format auto-fix**: `eslint --fix` and `prettier -w`.
3. **Snapshot updates**: Runs tests and updates snapshots.
4. **Type stubs**: Fetches updated types (`typesync`).
5. **Dependency re-resolve**: Runs lockfile updates (`npm update`).
6. **Static asset regeneration**: Optional generation step.

## Self-Scheduling

The repository adapts its run schedule based on commit and PR frequency. Frequent merges yield a faster frequency (e.g., every 4 hours), while a dormant repository may only self-heal once a week.

To override this, manually edit `.github/self-heal-schedule.yml` or `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- Check the PR diff for expected snapshot or formatting changes.
- Ensure that the security step passed (no secrets detected in diff).

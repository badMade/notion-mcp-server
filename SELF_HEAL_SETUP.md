# Self-Healing CI Pipeline Setup

This project uses an adaptive self-healing CI pipeline designed to automatically detect and repair configuration drift, linting errors, snapshot drifts, and dependency issues. It generates Pull Requests (PRs) for a human to review.

## Architecture

The system consists of:
1. **`scripts/healthcheck.mjs`**: A universal validation script that fails-fast if the repo is broken.
2. **`scripts/self_heal.mjs`**: Executes 6 idempotent repair steps (install, lint, snapshot, type stub, dependency update, asset generation) to attempt to fix the repo, verifying with `healthcheck.mjs` after each step.
3. **`scripts/compute_schedule.mjs`**: Analyzes repository telemetry (commit and PR velocity over the last 7 days) to determine how often the proactive self-heal pipeline should run.
4. **`.github/workflows/self-heal.yml`**: The main GitHub Actions workflow. Runs on a computed schedule, when the main `ci` workflow fails, or via manual dispatch.
5. **`.github/workflows/compute-schedule.yml`**: Periodically runs the `compute_schedule.mjs` script to adjust the proactive cadence dynamically.
6. **`.github/self-heal-schedule.yml`**: A metadata file tracking the current computed schedule and rationale.

## Self-Scheduling

The system analyzes telemetry to compute the optimal proactive schedule:
- **High/Active Velocity**: Pipeline runs multiple times a day or daily.
- **Dormant Velocity**: Pipeline scales back to once a week.
If you manually edit `.github/self-heal-schedule.yml`, the workflow will respect your changes until the next periodic recompute cycle (if your changes are overridden, disable the `compute-schedule.yml` workflow).

## Triggers
- **Scheduled**: Proactive drift fixes based on velocity telemetry.
- **Reactive**: Triggers immediately if the main CI workflow fails on the default branch.
- **Manual**: Can be triggered anytime via GitHub Actions `workflow_dispatch`.

## Reviewer Checklist
When reviewing a `selfheal-*` PR:
- [ ] Verify the repairs did not fundamentally change core business logic.
- [ ] Check snapshot updates to ensure they reflect correct, intended output.
- [ ] Ensure formatting and imports look clean.
- [ ] Verify there are no sensitive tokens/secrets accidentally committed (the pipeline prevents this natively, but verify).

## Troubleshooting
If the workflow continually opens PRs, check if the repairs are non-deterministic (e.g., oscillating timestamps).
To pause all self-healing, disable the `.github/workflows/self-heal.yml` action in your repository settings.

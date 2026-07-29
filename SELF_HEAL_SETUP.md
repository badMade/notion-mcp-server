# Self-Heal Automation Setup

This repository contains an automated self-healing pipeline for detecting and fixing configuration drift, minor linting issues, missing types, and dependency resolutions.

## How It Works

The system consists of three main parts:
1. **Healthcheck (`scripts/healthcheck.mjs`)**: Verifies the repository's health by running linting, typechecking, tests, and build.
2. **Self-Heal Pipeline (`scripts/self_heal.mjs`)**: Attempts to fix issues idempotently using six steps:
   - Rebuild/Reinstall
   - Lint/Format Autofix
   - Snapshot Updates
   - Type Stubs Config
   - Dependency Re-resolve
   - Static Asset Regeneration
3. **Schedule Computation (`scripts/compute_schedule.mjs`)**: Gathers telemetry data (e.g., PR velocity, CI failure rates) to determine the appropriate cadence to run the self-healing pipeline.

## Self-Scheduling

The self-scheduling logic adapts based on the repository's activity level:
- High PR velocity -> More frequent self-healing runs.
- Low PR velocity -> Infrequent self-healing runs.
- It automatically updates `.github/self-heal-schedule.yml` and updates the cron expression in `.github/workflows/self-heal.yml` via automated Pull Requests.

## Overriding the Schedule

If you want to manually override the self-computed schedule:
1. Edit `.github/self-heal-schedule.yml` with your desired cron expression.
2. Ensure the `# AUTO-UPDATED` marker exists on the cron line in `.github/workflows/self-heal.yml` so future automated computations don't lose the anchor (although you may disable `compute-schedule.yml` entirely if you want to freeze the schedule permanently).

## Reviewer Checklist for Self-Heal PRs

When reviewing a PR opened by the self-healing automation:
- Check the `repair.log` artifact attached to the workflow run.
- Ensure only allowed files (like `src/`, `tests/`, `package.json`) were changed.
- Verify no secrets, credentials, or `.env` files were accidentally committed.
- Verify the build and test workflows passed successfully on the PR.

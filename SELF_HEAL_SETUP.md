# Self-Healing Pipeline Setup

This project uses an automated self-healing pipeline designed to detect and repair configuration drift, formatting errors, dependency updates, and other automated changes without manual intervention.

## Architecture

The system consists of the following components:

- **`scripts/healthcheck.mjs`**: The gatekeeper. Verifies linting, tests, and builds. Fails if the system is unhealthy.
- **`scripts/self_heal.mjs`**: The idempotent repair pipeline. Runs 6 steps sequentially, checking health after each step.
- **`scripts/compute_schedule.mjs`**: Uses repository telemetry (like PR velocity and commit activity) to automatically adjust the cadence of proactive self-healing.
- **GitHub Workflows**:
  - `.github/workflows/self-heal.yml`: Triggered automatically via computed schedule, workflow_run (CI failures), or manually.
  - `.github/workflows/compute-schedule.yml`: Periodically recalculates the optimal self-healing frequency and opens a PR if it changes.
- **Metadata**: `.github/self-heal-schedule.yml` tracks the currently computed schedule to prevent oscillation thrashing.

## Pipeline Steps

The `scripts/self_heal.mjs` script performs these tasks idempotently:

1. **Rebuild/reinstall**: Cleans and installs tooling + dependencies.
2. **Lint/format auto-fix**: Attempts to automatically fix lint issues.
3. **Snapshot/generated updates**: Regenerates Vitest snapshots.
4. **Type stubs/analyzer config**: Fetches type declarations.
5. **Dependency re-resolve**: Bumps packages to their latest compatible versions within the lockfile constraints.
6. **Static asset regeneration**: Optional static code/docs generation.

After each step, if the codebase passes the `healthcheck` AND has a non-empty Git diff, the script immediately terminates, and the workflow creates a Pull Request.

## Reviewer Checklist

When reviewing an automated `selfheal-*` or `selfheal-schedule-*` Pull Request:

- **Verify Intent**: Look at the PR title to determine if the run was Scheduled, Reactive (CI fix), or Manual.
- **Check Changes**: Ensure the changes only involve standard automations (lockfiles, snapshots, formatting) and no business logic has been altered.
- **Security Check**: Confirm no credentials or environment variables were unintentionally committed.
- **Merge Safely**: If the CI passes and changes are legitimate, you may merge. The automation handles stale branches.

## Manual Overrides

If you wish to force a specific schedule rather than letting `compute_schedule.mjs` infer it:

1. Update `.github/self-heal-schedule.yml` with your desired `schedule`.
2. Ensure you modify the `last_updated` date to a very recent or future date to trigger the 24-hour oscillation guard, preventing the automation from immediately rewriting it.
3. Merge your PR.

## Required Secrets

To allow the schedule recomputation workflow to modify the `.github/workflows/self-heal.yml` file, you must provide a Personal Access Token (PAT) with `workflow` scope as a repository secret named `PAT_WITH_WORKFLOW_SCOPE`.

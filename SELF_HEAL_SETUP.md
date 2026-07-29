# Self-Healing Automation Setup

This repository has been configured with an adaptive, self-healing CI pipeline.

## How it works

The automation operates via two primary GitHub Actions workflows:

1. **Self-Heal Pipeline** (`.github/workflows/self-heal.yml`)
   This workflow acts upon code drift and CI failures by executing a series of 6 idempotent repair steps:
   - **Rebuild/reinstall:** Cleans environment and reinstalls tooling & dependencies (`npm ci`).
   - **Lint/format auto-fix:** Fixes style using `eslint` and `prettier`.
   - **Snapshot updates:** Updates test snapshots using `vitest run -u`.
   - **Type stubs:** Re-resolves and adds missing type definitions via `typesync`.
   - **Dependency re-resolve:** Refreshes the lockfile via `npm update`.
   - **Static asset regeneration:** Regenerates assets by running `npm run build`.

   If any of the repair steps generate a successful `diff` while simultaneously passing the strict internal `healthcheck.mjs`, the pipeline commits the changes to a new branch and automatically creates a PR for human review.

2. **Compute Self-Heal Schedule** (`.github/workflows/compute-schedule.yml`)
   This pipeline calculates the optimal execution cadence for proactive scheduled drift-checking. It leverages historical PR velocity telemetry using the GitHub CLI. Based on the calculated tier, it outputs the new schedule to `.github/self-heal-schedule.yml` and updates the cron expression in `self-heal.yml`. If the schedule is updated, it automatically issues a PR.

## Trigger Modes

- **Scheduled Trigger**: Runs on the dynamically computed adaptive schedule. Evaluates the codebase and attempts to repair any out-of-band drifts (like dependency changes or new typing issues).
- **CI Failure Trigger**: Reactively runs when a `ci` workflow failure is detected. This attempts to directly fix the issue without requiring human intervention on the broken branch.
- **Manual Dispatch**: Can be run ad-hoc via GitHub Actions UI for forced repairs.

## How to Manual Override the Schedule

If you want to manually hardcode the schedule, simply open `.github/workflows/self-heal.yml` and replace the `cron` line, keeping the `# AUTO-UPDATED` tag for tracking. Note that the `compute-schedule` workflow will overwrite this if it computes a tier mismatch during its scheduled check. To permanently disable adaptive updates, you can disable the `Compute Self-Heal Schedule` workflow in the UI.

## Reviewer Checklist

Whenever a PR is opened by this bot, reviewers should:
- [] Check the `repair.log` and `healthcheck.log` artifacts attached to the workflow run.
- [] Ensure the changes don't contain any secrets (though there are safeguards for this).
- [] Ensure changes are strictly mechanical (e.g. types, lockfiles, snapshots, formats) and not breaking business logic.
- [] For schedule PRs, review the rationale to make sure it aligns with your team's workflow cadence.

# Self-Heal Automation Setup

This repository is equipped with an automated self-healing pipeline designed to fix CI drift, format code, resolve dependency issues, and regenerate assets autonomously.

## Architecture

The system consists of the following components:

- **`scripts/healthcheck.mjs`**: A universal healthcheck script that verifies the repository state (build, lint, types, tests).
- **`scripts/self_heal.mjs`**: An idempotent 6-step repair script. It runs healthchecks after every step and exits early upon successful repair.
- **`scripts/compute_schedule.mjs`**: Analyzes repository telemetry (PR velocity) via the GitHub API to dynamically compute an optimal cron schedule.
- **`.github/workflows/self-heal.yml`**: Triggers proactively on a schedule, reactively upon CI failures, or manually via workflow dispatch.
- **`.github/workflows/compute-schedule.yml`**: Periodically re-evaluates and updates the repair schedule.
- **`.github/self-heal-schedule.yml`**: Stores the current computed schedule and metadata.

## Repair Pipeline (6 Steps)

1. **Rebuild/reinstall**: Runs `npm ci` or `npm install` for a clean slate.
2. **Lint/format**: Applies `eslint --fix` and `prettier --write`.
3. **Snapshots**: Updates vitest snapshots if applicable (`npx vitest run -u`).
4. **Type stubs**: Reserved for type stub generation/syncing.
5. **Dependency re-resolve**: Runs `npm update` to refresh the lockfile.
6. **Static assets**: Runs build scripts (e.g., `build-cli.js`).

## Self-Scheduling Logic

The pipeline adapts to the repository's activity level. `compute_schedule.mjs` fetches recently merged PRs to determine velocity:
- High PR velocity -> more frequent repair checks (e.g., every 4 hours).
- Low PR velocity -> less frequent checks (e.g., weekly).

To manually override the schedule, edit `.github/self-heal-schedule.yml` and the `# AUTO-UPDATED` line in `self-heal.yml`.

## Reviewer Checklist

When reviewing a `selfheal-*` PR, check the following:
- Ensure no sensitive information (API keys, secrets) was committed.
- Verify changes are limited to formatting, snapshots, lockfiles, or generated code (no core logic changes).
- Ensure the CI passes on the PR.
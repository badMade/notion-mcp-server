# Self-Healing Pipeline Setup

This repository is equipped with an automated self-healing pipeline designed to detect code drift, run idempotent repair steps, and automatically propose fixes via Pull Requests.

## Overview

The self-healing architecture comprises the following core components:

1. **`scripts/healthcheck.mjs`**: A strict gatekeeper script that verifies linting, types, tests, and builds. It exits with `0` on success and `1` on failure.
2. **`scripts/self_heal.mjs`**: An automated repair script running a 6-step idempotent pipeline. It halts and succeeds immediately if a fix resolves the healthcheck and produces a diff.
3. **`scripts/compute_schedule.mjs`**: A script that calculates an optimal execution cadence based on project telemetry (e.g., PR velocity).
4. **`.github/self-heal-schedule.yml`**: A configuration file storing the current schedule state, the rationale for the cadence tier, and a `last_updated` marker to prevent computation thrashing.
5. **`.github/workflows/self-heal.yml`**: The main GitHub Actions workflow triggered periodically, manually, or upon CI failure.
6. **`.github/workflows/compute-schedule.yml`**: A workflow running periodically to adjust the scheduling cadence.

## Repair Pipeline Steps

The `self_heal.mjs` script performs the following idempotent steps sequentially:

1. **Rebuild/reinstall**: Runs `npm ci` for a clean install of dependencies.
2. **Lint/format auto-fix**: Executes `npx eslint --fix` and `npx prettier --write`.
3. **Snapshot updates**: Runs tests and updates snapshots with `npx vitest run -u`.
4. **Type stubs**: Analyzes package dependencies and updates missing type definitions via `npx typesync`.
5. **Dependency re-resolve**: Runs `npm update` to update dependencies to their latest compatible versions.
6. **Static asset regeneration**: Executes `npm run build`.

After each step, the healthcheck is executed. If it passes and a diff is detected, the pipeline halts and creates a PR.

## Trigger Logic and Scheduling

The pipeline executes under three conditions:
- **Scheduled**: Runs automatically based on the cadence stored in `.github/self-heal-schedule.yml`.
- **CI Failure**: Reacts automatically if a push to a PR fails the primary CI checks.
- **Manual Dispatch**: Can be triggered via the Actions UI.

### Self-Scheduling Explanation

The `compute_schedule.mjs` script periodically evaluates project telemetry (such as the number of merged PRs) to assign a cadence tier (e.g., 'high', 'active', 'standard', 'low-churn', 'dormant'). When a change is detected, it proposes a PR to update both `.github/self-heal-schedule.yml` and the cron expression inside `.github/workflows/self-heal.yml`.

To prevent scheduling oscillation, updates are skipped if the schedule was adjusted recently (e.g., within the last 7 days).

### Manual Overrides

To manually override the schedule:
1. Edit the `schedule` value in `.github/self-heal-schedule.yml`.
2. Update the `cron` value in `.github/workflows/self-heal.yml` to match. Ensure the `# AUTO-UPDATED` anchor remains on the same line.
3. Push your changes. The oscillation guard will respect your manual update.

## Reviewer Checklist for Self-Heal PRs

When reviewing a PR opened by the `github-actions[bot]`:
- [ ] Verify the auto-generated changes are isolated and relevant to fixing the stated drift.
- [ ] Ensure no secret keys or sensitive information were unintentionally exposed.
- [ ] Confirm the tests successfully execute and there are no logic regressions.
- [ ] If the self-healing workflow is frequently resolving trivial drift, consider whether git pre-commit hooks should be configured locally.
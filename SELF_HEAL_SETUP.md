# Self-Healing Automation Setup

This repository contains an automated self-healing CI pipeline designed to fix drift, update lockfiles, regenerate snapshots, and enforce linting proactively.

## Architecture & Deliverables

1. **Gatekeeper Script** (`scripts/healthcheck.mjs`): A strict pass/fail script ensuring the project builds, lints, and passes tests.
2. **Repair Script** (`scripts/self_heal.mjs`): Runs an idempotent 6-step repair pipeline (reinstall, lint-fix, snapshots, stubs, dependencies, assets).
3. **Telemetry Script** (`scripts/compute_schedule.mjs`): Calculates the optimal interval to run scheduled self-healing based on commit/PR velocity.
4. **Schedule Config** (`.github/self-heal-schedule.yml`): Stores the current computed schedule and rationale.
5. **Self-Heal Workflow** (`.github/workflows/self-heal.yml`): The main pipeline triggered by schedule, CI failures, or manual dispatch.
6. **Compute-Schedule Workflow** (`.github/workflows/compute-schedule.yml`): Periodically adjusts the self-heal cadence based on repository activity.

## Triggers
- **Scheduled**: Runs automatically on the dynamically calculated interval (e.g. `0 0 * * *`).
- **Reactive**: Triggers automatically when the main `ci` workflow fails.
- **Manual**: Can be triggered manually via GitHub Actions UI (Workflow Dispatch).

## Manual Override
If you wish to hardcode the schedule and prevent the bot from automatically updating it:
1. Edit `.github/self-heal-schedule.yml`.
2. Update the `SCHEDULE` field to your desired cron string.
3. The oscillation guard logic will prevent immediate overwrites if you recently modified it, but you can also disable the `.github/workflows/compute-schedule.yml` workflow entirely in the GitHub UI.

## Reviewer Checklist
When a `self-heal-*` PR is opened, reviewers should:
- [ ] Review the artifact logs (`pre-check.log`, `repair.log`, `post-check.log`).
- [ ] Verify no actual application logic was improperly mutated.
- [ ] Merge the PR.

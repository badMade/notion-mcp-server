# Self-Heal Automation Setup

This project uses an automated self-healing pipeline designed to detect code drift, enforce formatting/linting, re-resolve dependencies, and fix failing tests (like outdated snapshots).

## Architecture
The system consists of 8 core deliverables:
1. **`scripts/healthcheck.mjs`**: A strict gatekeeper script that checks build, types, lint, and tests. It fails closed.
2. **`scripts/self_heal.mjs`**: Contains 6 idempotent repair steps: Rebuild/Reinstall, Lint/Format Fix, Update Snapshots, Types/Analyzer Config, Dependency Re-resolve, and Static Asset Regeneration. It exits with 0 only if the project passes the healthcheck AND a diff is produced.
3. **`scripts/compute_schedule.mjs`**: Gathers telemetry using GitHub CLI (PR frequency, CI failure rates) to determine the ideal schedule for running proactive self-healing.
4. **`.github/self-heal-schedule.yml`**: A configuration file holding the currently computed schedule cadence and rationale.
5. **`.github/workflows/self-heal.yml`**: The main GitHub Action workflow that reacts to triggers, checks drift, runs the repair pipeline, and creates PRs safely while avoiding duplicates and file constraints.
6. **`.github/workflows/compute-schedule.yml`**: A periodic workflow that checks telemetry and adjusts the main self-heal schedule dynamically via PRs.
7. **`package.json`**: Contains devDependencies required by the self-healing scripts (`eslint`, `prettier`, `js-yaml`, etc.).
8. **This `SELF_HEAL_SETUP.md` Document**: Explanation and reference guide.

## Triggers
1. **Scheduled (Proactive)**: Computed based on project velocity. Drift fixes are PR'd regularly.
2. **CI Failure (Reactive)**: Triggers automatically if the `ci` workflow fails.
3. **Manual Dispatch**: Can be triggered manually via the GitHub Actions UI.

## How Self-Scheduling Works
- The `compute-schedule.yml` workflow runs daily.
- It calculates PR velocity, failure rate, and identifies quiet hours in commit history.
- It scales the cadence up or down based on these metrics.
- If it detects a need to adjust, it updates `self-heal-schedule.yml` and the inline cron of `self-heal.yml`, then automatically creates a PR for human review.

## Reviewer Checklist
When reviewing a self-heal PR:
- [ ] Check the logs attached to the CI run to verify what changed.
- [ ] Ensure only expected files (like formatting, snapshots, `package-lock.json`) were modified.
- [ ] Ensure there are no leaked secrets or `.env` modifications.
- [ ] For schedule updates, read the rationale located in `.github/self-heal-schedule.yml` or the script output.

## Overriding the Schedule
To override the auto-computed schedule, manually edit the `SELFHEAL_SCHEDULE` field in `.github/self-heal-schedule.yml`. Ensure you edit the `cron` field matching the `# AUTO-UPDATED` tag in `.github/workflows/self-heal.yml` as well if you want it applied immediately without waiting for the compute workflow.

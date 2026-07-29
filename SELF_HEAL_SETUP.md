# Self-Healing Automation Setup

This repository is equipped with an automated self-healing pipeline designed to detect code drift, resolve common failures, and proactively adapt its scheduling based on the project's velocity.

## How It Works

The automation operates via GitHub Actions, and consists of three main components:

1. **`scripts/healthcheck.mjs`**: A rigorous validation script that exits `0` only if the repository is completely healthy (passing lint, types, tests, and build).
2. **`scripts/self_heal.mjs`**: An idempotent pipeline that attempts to fix issues in the following order:
   - Rebuild/Reinstall (`npm ci`)
   - Auto-Fix Formatting/Linting
   - Update Snapshots
   - Update Type Stubs
   - Resolve Dependencies
   - (Optional) Regenerate Static Assets
3. **`scripts/compute_schedule.mjs`**: A script that evaluates historical telemetry (commits, PR frequency) to calculate the most effective self-healing run frequency.

## Triggers

The self-healing pipeline triggers under three conditions:
- **Reactive:** After a failed CI run (`workflow_run`).
- **Proactive:** On a dynamically adjusted schedule (defined in `.github/self-heal-schedule.yml`).
- **Manual:** via GitHub Actions `workflow_dispatch`.

Whenever the pipeline succeeds in making a repair, it automatically opens a pull request. The bot strictly verifies that only allowed files are modified and prevents any leaks by scanning the git diff for secrets before opening the PR.

## Adaptive Scheduling

The project learns its ideal cadence. Twice a month, the `Compute Self-Heal Schedule` workflow executes `scripts/compute_schedule.mjs`.

- If the project experiences high churn (e.g., hundreds of commits), the pipeline runs more frequently (possibly daily).
- If the project goes dormant, it downgrades to a lower tier (e.g., weekly).
- If the schedule changes, a new PR labeled `self-heal-schedule` will be proposed.

## Manual Overrides

If you prefer a static schedule or want to force a specific frequency:
1. Open `.github/self-heal-schedule.yml`.
2. Update the `SELFHEAL_SCHEDULE` to your preferred CRON expression.
3. In `.github/workflows/self-heal.yml`, adjust the inline `cron: "..." # AUTO-UPDATED` marker to match.
4. You can optionally disable the `Compute Self-Heal Schedule` workflow in the GitHub UI to prevent future overrides.

## Reviewer Checklist

When reviewing a PR initiated by the self-healing bot, confirm the following:
- [ ] No unwanted files were altered (e.g., `.env`, `.github/workflows/ci.yml`).
- [ ] Ensure formatting or linting tweaks align with the current style guidelines.
- [ ] Verify snapshot changes are correct and accurately represent new intent, not an actual regression.
- [ ] Review any changed package dependencies for breaking functionality.
- [ ] For reactive PRs, confirm the updated code passes the previously failed CI pipeline.

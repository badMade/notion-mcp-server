# Self-Heal Auto-Repair Setup

This document describes the self-healing automation integrated into the repository to automatically detect, fix, and submit PRs for code drift and formatting issues.

## System Components

1.  **scripts/healthcheck.mjs**: Validates the project health using tests, linters, types, and build scripts.
2.  **scripts/self_heal.mjs**: Executes a sequential 6-step idempotent repair process (e.g. `npm ci`, `eslint --fix`, `prettier -w`, `vitest -u`, `typesync`, `npm update`). It validates health after each step and will exit immediately if a step succeeds and produces a git diff.
3.  **scripts/compute_schedule.mjs**: Dynamically computes an optimal run cadence based on recent git telemetry (commit volume).
4.  **GitHub Actions**:
    -   `self-heal.yml`: Runs the repair pipeline triggered by schedule, manual dispatch, or CI failures. Submits an automated PR using `gh pr create`.
    -   `compute-schedule.yml`: Recomputes the ideal schedule periodically and submits a PR if adjustments are needed.

## Triggers

The self-healing workflow is triggered via three different mechanisms:
1.  **Scheduled (`schedule`)**: Proactive monitoring that runs on a cadence determined by `compute_schedule.mjs` to detect codebase drift.
2.  **Reactive (`workflow_run`)**: Triggered immediately when the main `ci` workflow fails on the default branch.
3.  **Manual (`workflow_dispatch`)**: Can be manually triggered from the Actions tab for immediate execution and repair.

## Self-Scheduling Logic

The `scripts/compute_schedule.mjs` script gathers recent git commit frequency (e.g., last 30 days) and assigns a tiered schedule cadence:
-   **Dormant** (0 commits): Monthly.
-   **Low-churn** (< 10 commits): Weekly.
-   **Standard** (10 - 50 commits): Twice a week.
-   **Active** (50 - 150 commits): Daily.
-   **High** (> 150 commits): Every 12 hours.

This automatically optimizes compute resources during inactive periods and maintains responsiveness during active development.

## Manual Override Instructions

If you need to forcefully override the schedule and prevent the automatic recalculation from changing it back, you can:
1. Modify `.github/self-heal-schedule.yml` directly with your desired `schedule` value.
2. Modify `.github/workflows/self-heal.yml` schedule cron line to match the value above, preserving the `# AUTO-UPDATED` inline comment marker at the end.
3. The oscillation guard or logic in `scripts/compute_schedule.mjs` can be adjusted if needed to ignore future automated updates.

## Reviewer Checklist

When reviewing a self-heal or schedule update PR, human reviewers must verify the following:
-   [ ] **No unintended source logic changes**: The self-heal process is only intended for formatting, snapshots, and tooling updates. Confirm no business logic was modified.
-   [ ] **All health checks pass**: Ensure all CI status checks (tests, linters, types) are green for the self-heal branch.
-   [ ] **Review workflow logs**: Examine the artifact logs attached to the PR action run to understand why the drift occurred.
-   [ ] **Check for duplicate PRs**: Ensure this does not duplicate a previously opened PR. (The automation attempts to catch this, but manual verification provides redundancy).
-   [ ] **Verify valid schedule format**: For schedule update PRs, verify the cron expression is standard and valid.

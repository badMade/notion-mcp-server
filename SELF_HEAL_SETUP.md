# Self-Heal CI Pipeline Setup

This document explains the self-healing CI pipeline configured for this repository. The pipeline automatically attempts to repair codebase drift, formatting issues, missing types, and dependency updates.

## Triggers

The self-healing pipeline is triggered in three ways:

1.  **Scheduled:** A proactive cron job runs periodically. The schedule is automatically computed based on telemetry.
2.  **Reactive (CI Failure):** Triggered automatically whenever the `ci` workflow fails.
3.  **Manual Dispatch:** Can be triggered manually via the GitHub Actions UI (`workflow_dispatch`).

## Idempotent Repair Steps

When triggered, the pipeline runs `scripts/self_heal.mjs`, which executes the following idempotent steps sequentially. After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes and there is a git diff, the script immediately exits successfully and a PR is created.

*   **Step 1:** Clean install (`npm ci`) - Ensures tooling and dependencies are correctly installed.
*   **Step 2:** Lint & Format (`npx eslint --fix . && npx prettier -w .`) - Automatically fixes formatting and linting errors.
*   **Step 3:** Update Snapshots (`npx vitest run -u --passWithNoTests`) - Updates any out-of-date test snapshots.
*   **Step 4:** Type sync (`npx typesync`) - Acquires missing TypeScript type definitions.
*   **Step 5:** Update dependencies (`npm update`) - Safely refreshes the package lockfile and updates packages to their latest minor/patch versions.

## Self-Scheduling

The self-healing cadence is dynamic and adaptive. A separate workflow (`compute-schedule.yml`) runs periodically to evaluate the repository's commit and PR velocity over the last 30 days.

*   If the repository has high activity, the self-healing schedule will run more frequently.
*   If the repository is mostly dormant, it will scale down to run less frequently (e.g., weekly).

The computed schedule is saved to `.github/self-heal-schedule.yml` using a safe YAML round-trip mutator (`js-yaml`).

## Reviewer Instructions

Self-heal automation will never merge directly to `main` nor change source code logic. It operates entirely by creating pull requests for human review.

When reviewing a `selfheal-*` pull request:
1.  Check the PR title to determine the trigger (`[Self-Heal Scheduled]`, `[Self-Heal Reactive]`, `[Self-Heal Manual]`, or `[Self-Heal Schedule]`).
2.  Review the generated file diff to ensure no unexpected changes (only formatting, snapshots, deps, etc.).
3.  Examine the GitHub Actions Artifacts (`pre-check.log`, `repair.log`, `post-check.log`) to see the exact repair steps executed and why they failed initially.
4.  If everything looks correct, approve and merge the PR.

## Manual Overrides

If you wish to override the dynamically computed self-healing schedule:

1. Edit `.github/self-heal-schedule.yml`.
2. Update the `schedule` string with your desired cron expression.
3. Commit and push the changes. The pipeline will respect this override and the scheduler will use it as the base reference.

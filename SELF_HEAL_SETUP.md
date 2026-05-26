# Self-Healing CI Pipeline Setup

This repository is equipped with an automated self-healing CI pipeline designed to repair codebase drift, formatting issues, missing types, and outdated lockfiles autonomously.

## Pipeline Overview

The pipeline consists of three triggers, six idempotent repair steps, and a self-adjusting scheduler.

### Triggers
1. **Scheduled**: Runs proactively based on a cadence derived from repository activity telemetry.
2. **Reactive (CI Failure)**: Automatically triggered if the main CI workflow (`ci`) fails.
3. **Manual Dispatch**: Can be run manually at any time via GitHub Actions `workflow_dispatch`.

### Idempotent Repair Steps
The `scripts/self_heal.mjs` script attempts the following sequential repairs:
1. **Rebuild/Reinstall**: Clean dependency installation (`npm ci` or `pnpm install --frozen-lockfile`).
2. **Lint/Format Auto-Fix**: Automatically fixes ESLint and Prettier errors.
3. **Snapshot/Generated Updates**: Updates failing Vitest test snapshots.
4. **Type Stubs Acquisition**: Uses `typesync` to fetch missing TypeScript definitions.
5. **Dependency Re-resolve**: Refreshes lockfiles for safety updates.
6. **Static Asset Regeneration**: Updates generated docs or badges.

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the codebase becomes healthy *and* a file diff exists, the script halts and prepares a Pull Request.

## Self-Scheduling

The system autonomously manages its own scheduled cadence using `scripts/compute_schedule.mjs`.

- A rolling telemetry lookback window checks PR merge frequency and CI failure rates via the GitHub API.
- The workflow categorizes repository activity into tiers (high, active, standard, low-churn, dormant).
- It generates an optimized cron expression and updates `.github/self-heal-schedule.yml` via its own Pull Request (`compute-schedule.yml` workflow).

### Manual Override

If you wish to force a specific schedule and prevent the self-adjuster from changing it:
1. Edit `.github/self-heal-schedule.yml`.
2. Update the `schedule` string.
3. You must keep the `# AUTO-UPDATED` comment marker exactly inline with the `schedule:` key if manual override falls back to automated tuning later.
4. (Optional) Disable the `compute-schedule.yml` GitHub Actions workflow entirely.

## Reviewer Checklist for Self-Heal PRs
When reviewing an automated self-heal PR, verify:
- [ ] Only intended repair types (formatting, snapshots, lockfiles, types) are included.
- [ ] No application source code or test logic was structurally altered.
- [ ] No secrets or PII were inadvertently included in the diff.
- [ ] The pipeline successfully exited with a `0` code during final validation.

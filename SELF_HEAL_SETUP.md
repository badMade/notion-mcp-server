# Self-Healing Pipeline Setup

This repository contains a self-adapting repair automation pipeline to automatically resolve CI failures and system drift.

## Components

1. **`scripts/healthcheck.mjs`**: A strict gatekeeper that verifies system integrity (linting, tests, build). Exits `0` if healthy, `1` otherwise.
2. **`scripts/self_heal.mjs`**: An idempotent 6-step repair script. It sequentially attempts to rebuild dependencies, auto-fix formatting/linting, regenerate snapshots, update types, resolve dependencies, and rebuild the project.
3. **`scripts/compute_schedule.mjs`**: A script that evaluates repository telemetry (commits/PRs) to dynamically adjust the frequency of proactive repair runs.
4. **`.github/self-heal-schedule.yml`**: A configuration file storing the current computed schedule and rationale.
5. **`.github/workflows/self-heal.yml`**: The main GitHub Actions workflow. Runs on a computed schedule, after CI failures, or manually.
6. **`.github/workflows/compute-schedule.yml`**: A secondary GitHub Actions workflow that periodically re-evaluates the telemetry and opens PRs to update the schedule.

## How the Schedule Works

The schedule is adaptive. It uses a lookback window of commit frequency and PR history to categorize the repository into tiers (e.g., `high`, `active`, `standard`, `dormant`). If the repository is very active, checks run more frequently.

### Manual Override

To manually override the schedule and prevent auto-updates for a time:
1. Edit `.github/self-heal-schedule.yml` directly.
2. Ensure you update `.github/workflows/self-heal.yml` with the same `cron` string on the line marked `# AUTO-UPDATED`.
3. Auto-computations have an oscillation guard and won't immediately override manual tweaks.

## Reviewer Checklist

When a `[Self-Heal]` PR is opened, please verify:
- The changes are correct and only touch safe files (e.g., `src/`, `tests/`, `package.json`).
- No secrets or credentials were inadvertently committed.
- The PR was not stuck in a restart loop (the workflow automatically cancels in-progress groups).

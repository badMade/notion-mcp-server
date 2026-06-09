# Self-Healing CI Setup

This document describes the automated self-healing CI setup configured in this repository.

## Overview

The self-healing automation attempts to automatically repair code health and drift without human intervention. When triggered, it creates a Pull Request with the proposed repairs. A human must always review and merge these PRs.

## Triggers

1. **Scheduled:** Proactively runs to detect dependency drift, snapshot changes, or type issues. The cadence is computed dynamically based on repository activity.
2. **CI Failure (Reactive):** Automatically triggered when the main `ci` workflow fails.
3. **Manual Dispatch:** Can be run manually from the GitHub Actions tab.

## Self-Scheduling Logic

To avoid unnecessary CI runs, the scheduling is adaptive:
- A separate workflow (`Compute Self-Heal Schedule`) periodically gathers telemetry (PR merge frequency, CI failure rate, and commit times).
- Based on the velocity, it determines the best tier (from multiple times a day to once a week).
- Standard and low-churn runs are targeted at the quietest hours based on commit history.
- The schedule is written to `.github/self-heal-schedule.yml` and the core `self-heal.yml` file is updated automatically.

## Repair Pipeline

The automated scripts run idempotently through a 6-step pipeline:
1. **Rebuild/Reinstall:** Ensures clean tooling and dependencies.
2. **Lint/Format:** Fixes stylistic and syntactic issues.
3. **Snapshots:** Regenerates out-of-date snapshots.
4. **Type Stubs:** Acquires missing types using `typesync`.
5. **Dependencies:** Re-resolves dependencies via `npm update`.
6. **Static Assets:** Rebuilds necessary static assets.

After each step, a healthcheck validates the repair. If the system is healthy and a file diff exists, the repair exits and the workflow proposes a PR.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check the `pre-check.log`, `repair.log`, and `post-check.log` uploaded as workflow artifacts.
- [ ] Ensure the diff only contains expected fixes (formatting, snapshot updates, type changes, or dependencies).
- [ ] Ensure the PR is NOT altering actual logic or test assertions.
- [ ] Ensure no credentials, `.env` files, or secrets are leaked.

## Manual Override

If you need to manually override the dynamic schedule:
1. Edit `.github/self-heal-schedule.yml` directly in `main`.
2. Ensure you preserve the `# AUTO-UPDATED` marker in the `self-heal.yml` file, or simply remove the compute-schedule workflow entirely.

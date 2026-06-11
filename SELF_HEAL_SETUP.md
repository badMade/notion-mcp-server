# Self-Heal Setup

This repository is equipped with an automated self-healing CI pipeline.

## Overview

The self-heal pipeline detects drift, broken dependencies, and failing tests, then automatically attempts to repair them using an idempotent process.

### Triggers

- **Scheduled:** Computes an adaptive cadence based on commit/PR telemetry.
- **Reactive:** Runs whenever the main `ci` workflow fails.
- **Manual:** Can be run on demand via `workflow_dispatch`.

### Repair Steps

The `scripts/self_heal.mjs` script runs the following idempotent operations in order:
1. Rebuild/reinstall (`npm ci` / `npm install`)
2. Lint/format auto-fix (`eslint --fix`)
3. Snapshot regeneration (`vitest run -u`)
4. Type stubs (`typesync`)
5. Dependency re-resolve (`npm update`)
6. Static asset regeneration (`npm run build`)

Between each step, a healthcheck (`scripts/healthcheck.mjs`) ensures the codebase is healthy. If the codebase becomes healthy and the fix yields a git diff, the script succeeds.

### Self-Scheduling Logic

The `scripts/compute_schedule.mjs` runs periodically to gather telemetry (like commits over the last 7 days) to adapt the frequency of self-healing.
- High velocity: Run every 6 hours
- Active velocity: Run every 12 hours
- Standard: Run once a day
- Dormant: Run once a week

The optimal schedule is stored in `.github/self-heal-schedule.yml`.

### Override Instructions

If you need to force a specific schedule manually:
1. Edit `.github/self-heal-schedule.yml`.
2. Change the `schedule:` value to your preferred cron expression.
3. Update `last_updated:` to a recent ISO timestamp.

### Reviewer Checklist

When reviewing a PR prefixed with `[Self-Heal...]`:
1. Check that the branch is targeting `main` and is named `selfheal-...`.
2. Review the diff to ensure fixes are sound and don't overwrite intended manual changes.
3. Verify that tests pass locally.
4. Check that no unexpected dependencies were added.
5. Review the GitHub Actions logs (`pre-check.log`, `repair.log`, `post-check.log`) attached to the run for detailed context.

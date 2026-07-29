# Self-Heal Automation Setup

This repository is configured with a Self-Heal Coding Agent pipeline. It is designed to automatically detect and repair configuration drift, formatting, typescript stubs, and dependency resolution issues.

## Triggers

1. **Scheduled Runs (Proactive):** The system computes its own execution cadence based on recent commit/PR velocity (via `.github/workflows/compute-schedule.yml`). Runs will happen more frequently during active periods.
2. **CI Failure (Reactive):** If the primary `ci` workflow fails on `main`, the self-heal process is automatically triggered to attempt to find a quick, minimal fix.
3. **Manual Dispatch:** The workflow can be triggered manually at any time from the GitHub Actions tab.

## Repair Pipeline (scripts/self_heal.mjs)

The automation evaluates the following 6 idempotent steps. After each step, it runs the `healthcheck.mjs`. If the issue is resolved and a file diff was generated, it immediately creates a PR.

1. **Rebuild/reinstall** (`npm ci`)
2. **Lint auto-fix** (`eslint . --fix`)
3. **Snapshot updates** (`vitest run -u`)
4. **Type stubs** (`typesync`)
5. **Dependency re-resolve** (`npm update`)
6. **Static assets** (`npm run build`)

## Self-Scheduling

The schedule is driven by `.github/self-heal-schedule.yml` and re-evaluated periodically by `.github/workflows/compute-schedule.yml` by analyzing git history over the past 14 days.
To override this behavior:
1. Update `.github/self-heal-schedule.yml` manually.
2. The automation will respect manual edits and includes an oscillation guard to prevent immediate reverting.

## Reviewer Checklist

When reviewing a PR prefixed with `[Self-Heal...]`:
1. Verify no unintended source code logic changes (only formatting, snapshots, and config should change).
2. Review the artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) uploaded to the workflow run.
3. Ensure no secrets or API tokens were accidentally committed.

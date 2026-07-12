# Self-Healing Architecture for Notion MCP Server

This repository uses an automated self-healing pipeline to resolve test failures, lint errors, drift, and missing types. It runs proactively via a telemetry-based schedule, and reactively upon CI failures.

## 1. Triggers
The self-healing pipeline runs under three conditions:
- **Scheduled:** Computed from historical commit activity (runs prior to active hours).
- **CI Failure:** Triggers automatically if the `ci` workflow fails.
- **Manual:** Can be dispatched via GitHub Actions UI.

## 2. Core Scripts (`scripts/`)
- `healthcheck.mjs`: Strict gatekeeper. Exits 0 if tests, build, and lint pass.
- `self_heal.mjs`: Implements the 6-step idempotent repair pipeline:
  1. Rebuild / reinstall
  2. Lint & format
  3. Snapshot / generated updates
  4. Type stubs / typesync
  5. Dependency updates
  6. Static asset generation
- `compute_schedule.mjs`: Analyzes telemetry to find optimal schedule times and updates the cron expressions safely.

## 3. GitHub Actions Workflows (`.github/workflows/`)
- `self-heal.yml`: The main pipeline. Checks for duplicates, runs `self_heal.mjs`, runs the healthcheck, scans for secrets, and automatically creates a PR if drift is detected and successfully repaired.
- `compute-schedule.yml`: Periodically runs `compute_schedule.mjs` to adapt the proactive self-healing schedule to your repository's activity.

## 4. Metadata
- `.github/self-heal-schedule.yml`: Stores the current computed schedule and rationale to prevent oscillation and track context.

## 5. Reviewer Checklist
When a self-heal PR is opened, reviewers should:
1. Verify the diff looks correct and no unintended files were changed.
2. Confirm the CI passing status on the PR.
3. Merge it to apply the fixes.

## Overriding the Schedule
If you wish to override the self-computed schedule, modify `.github/self-heal-schedule.yml` directly. The oscillation guard logic will respect recent manual updates.

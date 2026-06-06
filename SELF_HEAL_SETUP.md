# Self-Healing Pipeline Setup

This project utilizes an automated self-healing CI pipeline to detect and fix common drift or CI failures automatically.

## How It Works

The pipeline is triggered via three methods:
1. **Scheduled Runs:** Runs periodically to detect project drift (e.g. out-of-date snapshots, new lint rules).
2. **Reactive Runs:** Triggers on failure of the `ci` workflow run.
3. **Manual Dispatch:** Can be run at any time via GitHub Actions UI.

## The Repair Pipeline
The pipeline is designed to be idempotent and executes the following steps in order, exiting early if it reaches a healthy state and successfully produces a fixing diff:
1. Rebuild/reinstall (clears and installs fresh dependencies).
2. Lint auto-fix (runs linters and formatters).
3. Snapshot updates (regenerates test snapshots).
4. Type stubs (ensures dependency typings are resolved).
5. Dependency resolution (updates lockfiles cautiously).
6. Static asset generation (rebuilds the output).

## Dynamic Scheduling
The schedule is computed dynamically using repository telemetry (e.g., number of commits). It runs on an adaptive cadence so that high-activity periods get frequent checks, while low-activity periods save CI resources.
If you need to manually override the schedule, edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` to match. The pipeline will respect manual overrides as long as they adhere to the standard schedule format.

## Reviewer Guidelines
When reviewing a PR prefixed with `[Self-Heal...]`:
1. Check the associated GitHub Actions run for the pre and post log artifacts to understand what was fixed.
2. Confirm the diff only touches relevant files (e.g., source code, test snapshots, config files) and has not modified sensitive configs unprompted.
3. Once approved, merge the PR as usual.
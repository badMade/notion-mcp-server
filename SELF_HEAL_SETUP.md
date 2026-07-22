# Self-Healing Pipeline Setup

This project includes an automated self-healing pipeline that runs via GitHub Actions.

## Triggers
The self-healing pipeline is triggered by:
1. **Scheduled Runs:** Periodically based on telemetry (via `.github/self-heal-schedule.yml`).
2. **CI Failures:** Whenever the main `ci` workflow fails.
3. **Manual Dispatch:** Can be triggered manually from the Actions tab.

## Architecture
The pipeline consists of the following scripts:
* `scripts/healthcheck.mjs`: Validates the state of the project (linting, type checking, tests, build). Exits 0 if healthy, 1 if not.
* `scripts/self_heal.mjs`: Implements the 6-step idempotent repair pipeline.
* `scripts/compute_schedule.mjs`: Analyzes git history to determine optimal schedule for self-healing. Updates `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml`.

## Repair Steps
The repair pipeline runs the following steps idempotently:
1. **Rebuild/reinstall**: Clean install dependencies (`npm ci`).
2. **Lint/format auto-fix**: `npx eslint --fix .` and `npx prettier -w .`
3. **Snapshot/generated updates**: `npx vitest run -u`
4. **Type stubs/analyzer config**: `npx typesync` and `npm install`
5. **Dependency re-resolve**: `npm update`
6. **Static asset regeneration**: `npm run build`

## Schedule Updates
The `compute-schedule.yml` workflow runs periodically to update the cadence based on repository velocity. The current schedule is stored in `.github/self-heal-schedule.yml`.

### Manual Override
To manually override the schedule, edit `.github/self-heal-schedule.yml` directly. The compute schedule workflow respects manual changes (if recently updated) and adjusts according to velocity over time.

## Reviewer Checklist
When reviewing a Self-Heal PR, ensure:
* [ ] The fix correctly resolves the CI failure or drift.
* [ ] No logical code changes were unintentionally made.
* [ ] No secrets or sensitive information are included.

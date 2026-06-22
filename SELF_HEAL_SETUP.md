# Self-Heal Auto-Repair

This repository includes an adaptive, self-healing automation pipeline that runs continuously to fix code drift and CI failures.

## Architecture & Workflows

1. **Self-Heal Workflow** (`.github/workflows/self-heal.yml`): Runs the repair steps triggered by failures or schedules.
2. **Compute Schedule Workflow** (`.github/workflows/compute-schedule.yml`): Runs periodically to check PR velocity and CI stability, dynamically calculating the most optimal schedule for self-healing.
3. **Repair Script** (`scripts/self_heal.mjs`): 6 idempotent steps executed in a universal safe order.
4. **Healthcheck Script** (`scripts/healthcheck.mjs`): Statically validates lint, tests, build, and types. Fails closed on any error.
5. **Schedule Metadata** (`.github/self-heal-schedule.yml`): Stores the current computed schedule and rationale.

## Triggers
- **Scheduled**: Runs on a dynamic interval based on telemetry (stored in `.github/self-heal-schedule.yml`).
- **Reactive (CI Failure)**: Listens for `workflow_run` failures on the main `ci` workflow and attempts a repair.
- **Manual**: Can be triggered via `workflow_dispatch`.

## Repair Steps (Universal Idempotent Order)
1. **Rebuild/reinstall (clean install)**: `npm ci`
2. **Lint/format auto-fix**: `eslint --fix .`
3. **Snapshot/generated updates**: `vitest run -u`
4. **Type stubs/analyzer config**: `typesync`
5. **Dependency re-resolve**: `npm update`
6. **Static asset regeneration**: `npm run build`

## Scheduling Logic
The self-healing schedule adapts to repo activity:
- High PR velocity -> Most frequent runs
- Low PR velocity -> Less frequent runs
- Empty runs (3+ consecutive) -> Decreases frequency
- Successful runs (3+ consecutive PRs) -> Increases frequency

### Manual Schedule Overrides
If you need to manually change the self-healing schedule:
1. Open `.github/self-heal-schedule.yml`.
2. Update the `SCHEDULE: "cron_expr" # AUTO-UPDATED` line to your desired schedule. **Leave the `# AUTO-UPDATED` marker.**
3. Update `LAST_UPDATED` to a future date if you want to prevent automatic recomputes for a while.

## Reviewer Checklist
When reviewing a self-heal PR:
1. Ensure the generated diff corresponds to the artifacts of automated tools (like snapshots or lockfiles).
2. Look out for logic changes (there should be none).
3. Check the linked artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) for verification.

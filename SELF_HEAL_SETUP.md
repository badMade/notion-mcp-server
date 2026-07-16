# Self-Heal Auto-Repair Setup

This repository is configured with an automated self-healing pipeline that detects CI failures and code drift, attempts a series of idempotent repairs, and opens a PR if successful.

## How it works

The system is triggered via:
1. **Scheduled:** Proactively runs to fix drift based on an adaptive schedule.
2. **CI Failure:** Reactively triggered if the main `ci` workflow fails.
3. **Manual:** Can be triggered via workflow dispatch.

## Repair Steps

1. **Rebuild/reinstall**: `npm ci`
2. **Lint/format**: `npx eslint --fix . && npx prettier -w .`
3. **Snapshots**: `npx vitest run -u`
4. **Type stubs**: `npx typesync`
5. **Dependencies**: `npm install`
6. **Static assets**: `npm run build`

## Self-Scheduling

The pipeline tracks PR velocity and self-healing success rates.
- `compute_schedule.mjs` evaluates git history and recent PRs to adjust the cron schedule.
- A separate workflow `compute-schedule.yml` runs this and opens a PR if the schedule needs adjustment.

## Overrides

To manually override the schedule, edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` to the desired schedule and merge to `main`. The `last_updated` field prevents immediate oscillation.

## Reviewer Checklist

- [ ] Confirm no recursive deletions occurred.
- [ ] Ensure changes don't manipulate test logic (only snapshot updates).
- [ ] Verify no secrets were committed.

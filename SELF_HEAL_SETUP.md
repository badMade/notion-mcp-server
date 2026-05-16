# Self-Healing Pipeline Setup

This project utilizes a self-healing CI pipeline designed to automatically fix code drift, formatting issues, and minor regressions.

## Triggers

The self-healing pipeline (`.github/workflows/self-heal.yml`) runs via three main triggers:

1. **Scheduled:** Runs on an adaptive schedule based on repository activity.
2. **Reactive (CI Failure):** Runs automatically if the main `ci` workflow fails.
3. **Manual Dispatch:** Can be triggered manually via the GitHub Actions UI.

## The Repair Pipeline

When triggered, the pipeline runs `scripts/self_heal.mjs`, which executes the following idempotent steps:

1. **Rebuild/reinstall:** Runs `npm ci`
2. **Lint/format auto-fix:** Runs `npx prettier -w .`
3. **Snapshot updates:** Runs `npx vitest run -u`
4. **Type stubs:** Runs `npx typesync` to acquire missing types
5. **Dependency re-resolve:** Runs `npm update`
6. **Static asset regeneration:** Runs `npm run build`

After each step, it runs a healthcheck (`scripts/healthcheck.mjs`). If the healthcheck passes and there's a git diff, a pull request is automatically opened for human review. It strictly guards against duplicate PRs and loop conditions.

## Adaptive Scheduling

The pipeline uses `scripts/compute_schedule.mjs` (run via `.github/workflows/compute-schedule.yml`) to calculate commit/PR velocity over the past 7 days and adjust the cadence of scheduled repair runs.

- High velocity (>50 commits/week) -> every 4 hours
- Active velocity (>20 commits/week) -> every 12 hours
- Standard velocity (>5 commits/week) -> daily
- Low velocity (>0 commits/week) -> twice weekly
- Dormant -> once weekly

If the computed schedule changes, a PR is automatically generated to update `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

## Manual Overrides

To manually override the schedule:
1. Open `.github/self-heal-schedule.yml`.
2. Update the `schedule` value with your preferred cron expression.
3. Commit and push the changes.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check the changed files (only formatting, snapshots, `package.json`, etc. are allowed).
- [ ] Ensure no source code logic has been automatically modified.
- [ ] Ensure tests are green.

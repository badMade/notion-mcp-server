# Self-Heal Automation Setup

This repository is equipped with a self-healing automation system designed to fix drift and maintain project health.

## Triggers
1. **Scheduled**: Runs periodically based on project cadence.
2. **CI Failure**: Runs reactively if the main CI workflow fails.
3. **Manual Dispatch**: Can be triggered manually from the GitHub Actions tab.

## Repair Pipeline (Idempotent)
1. **Rebuild/reinstall**: Clean install of tooling and dependencies.
2. **Lint/format auto-fix**: Runs `npx eslint --fix` and `npx prettier -w`.
3. **Snapshot updates**: Runs `npx vitest run -u` to update test snapshots.
4. **Type stubs**: Runs `npx --yes typesync` to acquire missing types.
5. **Dependency re-resolve**: Runs `npm update`.
6. **Static asset regeneration**: Regenerates docs or other artifacts if necessary.

## Self-Scheduling
The schedule is automatically computed by `compute-schedule.yml` based on PR velocity and commit activity telemetry.

## Overriding the Schedule
To manually override the schedule, edit `.github/self-heal-schedule.yml` and provide your desired CRON string.

## Reviewer Checklist
- Review the generated `selfheal-*` PR.
- Ensure no unintended logical changes were introduced.
- Merge once CI passes.
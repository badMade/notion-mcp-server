# Self-Heal Setup

This project uses an automated self-healing pipeline designed to detect and fix CI failures and system drift automatically.

## Pipeline Steps
The pipeline evaluates 6 idempotent steps when a failure or drift is detected:
1. Rebuild/reinstall (clean install of tooling + deps)
2. Lint/format auto-fix
3. Snapshot/generated updates
4. Type stubs/analyzer config
5. Dependency re-resolve
6. Static asset regeneration

If any step produces a successful healthcheck and valid code diff, a PR is opened.

## Self-Scheduling Logic
The `compute-schedule.yml` workflow periodically reads PR velocity and commit telemetry to adjust the self-heal schedule cadence automatically.

## Manual Override
To override the schedule, you can manually edit `.github/self-heal-schedule.yml` and modify the schedule expression.

## Reviewer Checklist
When reviewing a self-heal PR:
- [ ] Ensure changes are restricted to formatting, snapshots, types, or lockfiles.
- [ ] No application logic is modified.
- [ ] CI passes on the PR.

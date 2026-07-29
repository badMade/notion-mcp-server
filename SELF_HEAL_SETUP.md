# Self-Healing CI Pipeline

This repository implements a self-adapting repair pipeline to fix CI failures and project drift automatically.

## Triggers

1. **Scheduled:** Runs on a self-computed cadence based on repository activity to catch drift.
2. **Reactive:** Triggers automatically whenever the main CI workflow fails on `main`.
3. **Manual:** Can be triggered manually via `workflow_dispatch` in the Actions tab.

## The Repair Pipeline (6 Steps)

The pipeline is idempotent and uses existing tooling:

1. **Rebuild/Reinstall:** Clean installation of dependencies (`npm ci`).
2. **Auto-Format:** Runs `prettier` to fix formatting drift.
3. **Update Snapshots:** Runs tests to update Vitest snapshots.
4. **Update Type Stubs:** Synchronizes TypeScript definitions.
5. **Update Lockfile:** Updates dependencies.
6. **Build Project:** Runs the build command.

After each step, a health check is performed. If the project becomes healthy and there is a diff, it safely generates a Pull Request for human review. It fails closed to prevent erroneous code pushes.

## Schedule Computation

The `compute_schedule.mjs` script runs weekly. It analyzes the recent `git log` to determine commit frequency and adjusts the cron schedule for the proactive self-heal runs automatically. A PR is opened if the schedule needs to be updated.

## Manual Overrides

If you wish to override the schedule manually:
1. Edit `.github/self-heal-schedule.yml`.
2. Commit the changes. The pipeline respects manual changes up to the next periodic recompute.

## Reviewer Checklist for Self-Heal PRs
- [ ] Review the drift summary.
- [ ] Ensure no secret files or tokens were inadvertently modified.
- [ ] Check if the changes match expected snapshot/formatting updates.
- [ ] Approve and merge manually (auto-merge is disabled by design).

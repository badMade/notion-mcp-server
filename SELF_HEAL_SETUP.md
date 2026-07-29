# Self-Heal Auto-Repair Automation

This project uses an adaptive self-healing mechanism to automatically repair common code issues, code drift, formatting, and update tests snapshots.

## How it works
The self-healing pipeline (`.github/workflows/self-heal.yml`) triggers on:
1. **Schedule**: A cron expression determined by project telemetry (PR velocity).
2. **CI Failure**: When the `ci` workflow fails.
3. **Manual**: Using `workflow_dispatch`.

It executes `scripts/self_heal.mjs` which follows an idempotent repair process:
1. Installs dependencies (`npm ci`)
2. Lints & Formats (`eslint --fix` & `prettier -w`)
3. Updates Snapshots (`vitest run -u`)
4. Syncs Type stubs (`typesync`)
5. Updates minor/patch dependencies (`npm update`)

If the healthcheck (`scripts/healthcheck.mjs`) passes *and* there is a git diff, a pull request is automatically opened for human review.

## Self-Scheduling
The schedule is not hardcoded. The `.github/workflows/compute-schedule.yml` runs weekly to execute `scripts/compute_schedule.mjs`.

This script queries recent PR velocity using the GitHub CLI and calculates a cadence tier (e.g., Active, Standard, Dormant). The new schedule is written to `.github/self-heal-schedule.yml` and a PR is opened if the schedule has changed.

## Manual Overrides
To force a specific schedule and ignore auto-updates:
1. Edit `.github/self-heal-schedule.yml`
2. Set your desired cron expression in `SELFHEAL_SCHEDULE: '0 2 * * *'`
3. Set `OVERRIDE: true`

## Reviewer Checklist
When reviewing a `[Self-Heal]` PR:
- [ ] Confirm changes correctly fix build failures or update snapshots.
- [ ] Ensure no secret tokens or keys were committed.
- [ ] Confirm there's no modification to workflow logic (unless it's a schedule update PR).
- [ ] Verify test paths or snapshots haven't introduced logical regressions.

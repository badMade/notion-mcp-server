# Self-Heal Automation Setup

This repository is equipped with a self-adapting auto-repair pipeline designed to fix CI drift, linting errors, missing types, and dependency issues automatically.

## How It Works

The pipeline is triggered in three ways:
1. **Scheduled:** Proactively runs based on a computed schedule.
2. **Reactive:** Triggers automatically if the main `ci` workflow fails.
3. **Manual:** Can be dispatched via the GitHub Actions UI.

When triggered, it runs `scripts/self_heal.mjs` which performs up to 6 idempotent repair steps:
1. **Rebuild/reinstall:** Cleans and installs tooling + deps (`npm ci`).
2. **Lint/format:** Auto-fixes formatting and linting errors.
3. **Snapshots:** Updates testing snapshots (`vitest -u`).
4. **Types:** Syncs type stubs (`typesync`).
5. **Dependencies:** Refreshes lockfile.
6. **Assets:** Regenerates static assets/builds.

After each step, the system runs a strict `healthcheck.mjs`. If the healthcheck passes *and* there is a positive diff, it stops and opens a Pull Request.

## Self-Scheduling Logic

The `compute-schedule.yml` workflow runs periodically to analyze the repository's git activity and PR merge telemetry. It determines the quietest hours and sets an appropriate cadence (high, active, standard, low).

If the computed schedule changes, it automatically opens a PR to update `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

### Manual Overrides

If you wish to override the schedule manually, you can edit `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`. Make sure to preserve the `# AUTO-UPDATED` comment on the schedule line, otherwise the compute script may fail to parse it correctly during its next run.

## Reviewer Checklist

When reviewing a `selfheal-*` PR, please check:
- [ ] No unauthorized or unexpected logic changes were introduced.
- [ ] No secrets or sensitive data were accidentally committed.
- [ ] The fix correctly resolves the CI failure or drift.
- [ ] Any updated snapshots accurately reflect intended behaviors.

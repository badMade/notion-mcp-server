# Self-Healing Pipeline Setup

This repository contains a Self-Healing automation suite designed to adaptively fix code drift (linting, missing types, formatting, snapshot updates, etc.) and automatically generate Pull Requests.

## Trigger Mechanics
The self-healing workflow (`.github/workflows/self-heal.yml`) runs on three potential triggers:
1. **Scheduled:** Proactively runs to fix drift, guided by `.github/self-heal-schedule.yml`.
2. **Reactive:** Triggers automatically whenever the `ci` workflow fails.
3. **Manual Dispatch:** Can be triggered anytime via GitHub Actions UI.

## The Repair Pipeline
When triggered, `scripts/self_heal.mjs` safely executes an idempotent 6-step pipeline:
1. **Rebuild/reinstall:** Runs `npm ci`
2. **Lint/format auto-fix:** Runs `eslint --fix` and `prettier -w`
3. **Snapshot updates:** Runs test snapshot regeneration via `vitest run -u`
4. **Type stubs:** Downloads missing type definitions via `typesync`
5. **Dependency re-resolve:** Safe `npm update`
6. **Static asset regeneration:** Regenerates required static assets.

After each step, it runs a strict healthcheck baseline (`scripts/healthcheck.mjs`). If the project becomes healthy *and* a file diff was produced, it halts immediately and creates a PR to prevent unnecessary modifications.

## Self-Scheduling Logic
To reduce CI spam while still remaining proactive, the `compute-schedule.yml` workflow periodically looks at the repository's commit velocity over the past 7 days to assign a "cadence tier" (High, Active, Standard, Low Churn, Dormant).
It will automatically update `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` if the frequency should change.

## Manual Overrides
To force a specific schedule manually:
1. Edit `.github/workflows/self-heal.yml` and modify the cron line ending in `# AUTO-UPDATED`.
2. Update `.github/self-heal-schedule.yml` to match, and set `last_updated` to a future timestamp (in milliseconds) to prevent the auto-updater from overwriting your override immediately.

## Reviewer Checklist
Whenever the bot opens a Self-Heal PR, please verify:
- [ ] No unintended dependency bumps occurred during re-resolution.
- [ ] Test snapshots changed for intended reasons, not due to regressions.
- [ ] Linting/Formatting changes look structurally correct.
- [ ] The PR diff does not contain unexpected files (safety gates block most, but a human check is vital).

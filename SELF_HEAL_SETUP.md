# Self-Healing Architecture

This repository uses a self-adapting, autonomous repair pipeline designed to automatically fix code drift, linting errors, snapshot drift, and missing type definitions.

## Triggers
1. **Scheduled**: Runs periodically on the default branch. The schedule adapts based on project activity (via `scripts/compute_schedule.mjs`).
2. **Reactive (CI Failure)**: Listens for failures on the `ci` workflow and attempts to auto-repair.
3. **Manual Dispatch**: Can be triggered manually via the GitHub Actions tab.

## The Pipeline
The script `scripts/self_heal.mjs` executes a 6-step idempotent process:
1. **Rebuild/Reinstall**: Clean `npm ci` to reset dependencies.
2. **Lint Autofix**: Runs `eslint --fix` and `prettier -w`.
3. **Snapshot Generation**: Runs `vitest run -u` to update any stale snapshots.
4. **Type Stubs**: Updates types config (if applicable).
5. **Dependency Re-resolve**: Runs safe `npm update` to re-resolve valid tree.
6. **Asset Regeneration**: (Optional/Reserved for generated assets).

If these steps alter any files **and** pass the strict validation in `scripts/healthcheck.mjs`, a pull request is automatically opened.

## Adaptive Schedule
The workflow cadence automatically adjusts itself based on your commit frequency and PR velocity over the last 30 days.
- If you're highly active, it may check multiple times a day.
- If the project is dormant, it will scale back to weekly runs.

### Manual Override
To override the cadence:
Modify the `SELFHEAL_SCHEDULE` field in `.github/self-heal-schedule.yml`.

## Reviewer Checklist
When reviewing a self-heal PR:
- [ ] Check `pre-check.log` and `repair.log` artifacts to understand the nature of the drift.
- [ ] Ensure that snapshot or lint updates are logically correct, and not masking a deeper issue.
- [ ] Ensure no forbidden files or secrets were modified.

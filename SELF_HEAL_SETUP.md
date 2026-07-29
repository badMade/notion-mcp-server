# Self-Heal Automation Setup

This repository is equipped with an adaptive self-healing CI automation pipeline designed to automatically fix code drift, formatting issues, and test snapshots without manual intervention.

## Triggers
1. **Scheduled:** Runs periodically on the default branch based on a schedule computed dynamically from project velocity.
2. **Reactive:** Triggers automatically whenever the main `ci` workflow fails.
3. **Manual:** Can be triggered manually via `workflow_dispatch`.

## Self-Scheduling Logic
The schedule is not hardcoded. The `.github/workflows/compute-schedule.yml` workflow periodically measures project activity (commits over a 30-day window) and assigns a velocity tier (e.g., dormant, low-churn, standard, active, high). It then updates the schedule expression in `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` automatically via a PR.

### How to Override
If you want to manually override the schedule:
1. Edit `.github/self-heal-schedule.yml`.
2. Update the `schedule` field to your desired cron string.
3. The `compute_schedule.mjs` script respects recent updates (oscillation guard is 3 days). If you manually edit it, the script will consider that timestamp and will not immediately overwrite it.

## The Repair Pipeline
The `scripts/self_heal.mjs` script runs a strictly ordered, idempotent 6-step repair process:
1. **Rebuild/reinstall:** `npm ci`
2. **Lint/format auto-fix:** `npx eslint --fix .`
3. **Snapshot regeneration:** `npx vitest run -u --passWithNoTests`
4. **Type stubs/analyzer config:** `npx typesync`
5. **Dependency re-resolve:** `npm update`
6. **Static asset regeneration:** `npm run build`

After each step, `scripts/healthcheck.mjs` is run to verify if the project is healthy. If it is healthy and a file diff was produced, the repair process stops early and safely exits.

## Reviewer Checklist
When a `[Self-Heal *]` PR is opened, a human must review it before merging:
- [ ] Check the PR description for the trigger source (Scheduled vs Reactive vs Manual).
- [ ] Review the artifact logs attached to the GitHub Actions run to see what step fixed the issue.
- [ ] Ensure that only expected paths (`src/`, `tests/`, `package.json`, etc.) were modified.
- [ ] No secrets or `.env` files are in the diff.
- [ ] No unexpected dependency major version bumps.

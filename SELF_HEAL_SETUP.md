# Self-Heal Pipeline

This repository includes an adaptive, automated self-healing pipeline designed to fix dependency, formatting, and minor drift issues via Pull Requests. It is built to ensure a high baseline of project health while leaving final review to humans.

## How it works

The pipeline executes a 6-step idempotent repair process:
1. Rebuild/reinstall (`npm install`)
2. Lint/format auto-fix (`eslint --fix` & `prettier -w`)
3. Snapshot updates (`vitest run -u`)
4. Type stubs/analyzer config (skipped, unneeded for this repo)
5. Dependency re-resolve (`npm update`)
6. Static asset regeneration (`npm run build`)

After each step, the pipeline runs a strict healthcheck (`npm run build`, `eslint`, `tsc`, `vitest`). If the project passes the healthcheck AND there is a non-empty git diff, a repair PR is automatically generated.

## Triggers

The self-heal pipeline runs in three scenarios:
1. **Scheduled:** Runs on an adaptive cadence computed dynamically based on the project's PR and commit velocity.
2. **Reactive:** Triggers automatically if the primary `ci` workflow fails on the `main` branch.
3. **Manual:** Can be dispatched manually via the GitHub Actions UI.

## Schedule Computation

The cadence for the scheduled trigger is managed by a separate script (`scripts/compute_schedule.mjs`). This script analyzes the `git rev-list --count HEAD` output to adjust the frequency based on recent activity.
- The computed schedule is stored in `.github/self-heal-schedule.yml`.
- A dedicated workflow (`compute-schedule.yml`) runs weekly to re-evaluate this schedule and open a PR if the telemetry suggests a different cadence.

## Reviewer Checklist

When reviewing a self-heal PR, ensure:
- The PR title matches the expected format (e.g. `[Self-Heal Scheduled] Drift fixes`).
- Artifacts containing execution logs (`pre-check.log`, `repair.log`, `post-check.log`) have been reviewed for unexpected errors.
- No files outside the allowed scopes (e.g. `src/`, `tests/`, `package.json`) were altered. The pipeline explicitly guards against modifications to `.env`, `secrets/`, or workflow files (`.github/workflows/ci.yml`).
- No secrets or credentials are included in the diff.

## Manual Overrides

If you wish to override the computed schedule manually:
1. Open `.github/self-heal-schedule.yml`.
2. Modify the `schedule` value to a valid cron string.
3. The pipeline will respect this change, though if the repository falls completely dormant or becomes highly active, the `compute-schedule.yml` workflow may propose an update later.

# Self-Heal Pipeline Setup

This project uses an automated self-healing CI pipeline configured via GitHub Actions.

## Triggers

1.  **Scheduled:** A computed schedule runs automatically to fix code drift (formatting, deps update, type stubs, snapshots). The cadence is adaptive based on repository commit velocity.
2.  **Reactive (CI Failure):** Triggered when the main `ci` workflow fails. It attempts to repair and opens a PR.
3.  **Manual Dispatch:** Can be manually started via GitHub Actions UI.

## Self-Scheduling Mechanism

The `.github/workflows/compute-schedule.yml` runs weekly to check the repository activity (commits, PRs).
It determines a velocity (e.g., dormant, low-churn, standard, active, high) and updates `.github/self-heal-schedule.yml`. If the schedule is modified, an automated PR is created to update `.github/workflows/self-heal.yml`.

## Repair Pipeline Steps

The script `scripts/self_heal.mjs` executes 6 idempotent steps:
1.  **Rebuild/reinstall:** Cleans and reinstalls dependencies (`npm ci`).
2.  **Lint/format auto-fix:** Fixes lint issues (`eslint --fix` & `prettier -w`).
3.  **Snapshot updates:** Updates tests snapshots (`vitest run -u`).
4.  **Type stubs:** Gathers missing type stubs (`typesync`).
5.  **Dependency re-resolve:** Updates dependency tree (`npm update`).
6.  **Static asset regeneration:** Regenerates build files (`npm run build`).

A health check runs after each step. The script only completes successfully if the health check passes and a code diff is produced.

## Overrides and Manual Intervention

- **To override the computed schedule:** Manually edit `.github/self-heal-schedule.yml` and commit. The system respects manual overrides until the next major computation drift.
- **Reviewing PRs:** All automated PRs are labeled `self-heal`. They contain links to downloaded artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) detailing what was fixed.

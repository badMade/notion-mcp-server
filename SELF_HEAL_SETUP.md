# Self-Heal CI Setup

This document describes the automated Self-Heal CI pipeline configured in this repository.

## Purpose

The pipeline detects codebase drift (e.g. failing tests, unformatted code, missing types) and automatically attempts to repair it. It ensures standard hygiene routines are run frequently and without human intervention, submitting any necessary corrections as a PR.

## Trigger Mechanics

There are three ways the self-heal workflow can trigger:
1. **Scheduled (Proactive):** Periodically checks for drift and runs repairs.
2. **CI Failure (Reactive):** Triggers automatically when the main `ci` workflow fails.
3. **Manual Dispatch:** Can be manually triggered from the Actions tab.

## Self-Scheduling

The proactive scheduled cadence is not hardcoded. The `compute_schedule.mjs` script (triggered via `.github/workflows/compute-schedule.yml`) analyzes recent project velocity and CI metrics to determine how frequently self-healing should run.

- High velocity => More frequent runs (e.g. every 6 hours).
- Low velocity => Infrequent runs (e.g. once a week).

The current schedule is stored in `.github/self-heal-schedule.yml` and updating the cadence automatically generates a PR labeled `self-heal-schedule`.

### Overriding the Schedule

If you want to manually override the schedule:
1. Edit `.github/self-heal-schedule.yml`.
2. Edit `.github/workflows/self-heal.yml` to match the cron line.
3. The script features an oscillation guard—ensure the `LAST_UPDATED` timestamp is recent, or the computed script might temporarily ignore overrides until the time lock passes.

## Idempotent Repair Steps

The `scripts/self_heal.mjs` applies the following steps in order. It checks project health after each step to see if a minimal fix was achieved.

1. **Rebuild/Reinstall:** Clean install of dependencies (`npm ci || npm install`).
2. **Lint & Format:** Auto-fixes formatting (`eslint --fix`, `prettier -w`).
3. **Snapshots:** Regenerates tests (`vitest run -u`).
4. **Types:** Resolves missing TypeScript stubs (`typesync`).
5. **Dependencies:** Re-resolves and updates packages (`npm update`).
6. **Assets:** Regenerates static build targets.

## PR Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Check the uploaded Artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) to verify what broke and how it was fixed.
- [ ] Ensure the changes do not modify the core logic or business rules.
- [ ] Verify that there are no leaked secrets or sensitive configurations.
- [ ] Ensure tests pass successfully on the self-healing branch.
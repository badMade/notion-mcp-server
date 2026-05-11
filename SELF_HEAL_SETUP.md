# Self-Healing CI Setup

This repository uses an automated self-healing CI pipeline designed to fix code drift (formatting, missing types, outdated snapshots, etc.) automatically.

## Triggers

The self-heal pipeline runs under three conditions:
1. **Scheduled:** Proactive runs based on a telemetry-derived schedule.
2. **Reactive:** Automatically triggered when the main `ci` workflow fails on the default branch (`workflow_run`).
3. **Manual:** Can be triggered manually via `workflow_dispatch`.

## Pipeline Steps

The `scripts/self_heal.mjs` script performs the following idempotent steps:
1. **Clean Install:** `npm ci`
2. **Format:** `npx prettier -w .`
3. **Update Test Snapshots:** `npx vitest run -u`
4. **Install Missing Types:** (Placeholder for `typesync` or similar)
5. **Update Dependencies:** `npm update`
6. **Asset Regeneration:** (Placeholder)

After each step, a health check (`scripts/healthcheck.mjs`) is run to verify type checking, tests, and build. If the health check passes and a git diff exists, the pipeline halts and a PR is opened.

## Self-Scheduling Logic

The proactive schedule is not static. A separate workflow (`compute-schedule.yml`) runs periodically to evaluate repository telemetry (PR merge frequency and commit times) via `scripts/compute_schedule.mjs`.

Based on this telemetry, it computes an optimal schedule (e.g., daily during active periods, weekly during inactive periods) and updates `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` via an automated PR.

### How to Override the Schedule

If you want to manually set the schedule:
1. Edit `.github/self-heal-schedule.yml` and update the `schedule` value.
2. Edit `.github/workflows/self-heal.yml` and modify the cron line under `on.schedule`, ensuring you keep the `# AUTO-UPDATED` comment marker.
   Example: `- cron: '0 5 * * *' # AUTO-UPDATED`

## Reviewer Checklist

When reviewing a `selfheal-*` PR, please check:
- [ ] No unauthorized dependency additions.
- [ ] Logic remains unchanged; only formatting, snapshots, or types were altered.
- [ ] No secrets or PII are exposed in the diff.
- [ ] CI passes on the self-heal PR itself.

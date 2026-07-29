# Self-Heal CI Setup

This project uses an automated self-healing CI pipeline configured via GitHub Actions.

## Overview
The pipeline detects code drift and formatting issues automatically and tries to repair them.
It creates an auto-generated Pull Request containing the repairs, which must be reviewed by a human before merging.

## Triggers
1. **Scheduled (Proactive):** Runs on a dynamically computed schedule to catch drift (e.g., dependency updates, formatting).
2. **CI Failure (Reactive):** Runs automatically when a PR fails the main CI workflow.
3. **Manual Dispatch:** Can be run at any time via the GitHub Actions UI.

## Self-Scheduling Logic
The schedule for the proactive trigger is periodically recomputed based on telemetry (like PR merge frequency and CI failure rates).
This is handled by the `compute-schedule.yml` workflow, which will open a PR if the computed schedule changes.

## Repair Pipeline
The pipeline runs an idempotent 6-step repair process (`scripts/self_heal.mjs`):
1. **Rebuild/reinstall:** `npm ci`
2. **Lint/format auto-fix:** `npx eslint --fix . && npx prettier -w .`
3. **Snapshot updates:** `npx vitest run -u --passWithNoTests`
4. **Type stubs:** `npx typesync`
5. **Dependency re-resolve:** `npm update`
6. **Static asset regeneration:** `npm run build`

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes and there is a diff, a PR is generated.

## Reviewer Checklist
When reviewing a self-heal PR, ensure:
- [ ] No unintended source code logic changes were introduced.
- [ ] Snapshots reflect correct behavior, not just masking a bug.
- [ ] Formatting changes are consistent with project standards.
- [ ] The build passes locally.

## Manual Overrides
To override the dynamically computed schedule, you can manually update the `cron` string in `.github/workflows/self-heal.yml` (ensure the `# AUTO-UPDATED` marker is preserved) and update the rationale in `.github/self-heal-schedule.yml`.
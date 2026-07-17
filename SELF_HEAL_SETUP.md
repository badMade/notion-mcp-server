# Self-Heal Pipeline

This repository uses an automated self-healing pipeline to prevent drift and fix common CI issues automatically.

## Triggers

1. **Scheduled:** Runs proactively based on an adaptive schedule.
2. **Reactive:** Runs automatically when the main `ci` workflow fails.
3. **Manual:** Can be triggered manually via the GitHub Actions UI.

## How it works

The system uses `scripts/self_heal.mjs` to run a series of idempotent repair steps:
1. Reinstall dependencies
2. Lint and format code
3. Update test snapshots
4. Sync TypeScript types
5. Update dependencies safely
6. Rebuild static assets

After each step, a strict gatekeeper `scripts/healthcheck.mjs` verifies the system. If it passes and there are changes, a PR is automatically generated.

## Self-Scheduling

The pipeline adjusts its own frequency based on repository telemetry (e.g., PR velocity and CI failure rates) via `scripts/compute_schedule.mjs`.
- High churn = more frequent runs.
- Low churn = infrequent runs.

To override the schedule manually, edit `.github/self-heal-schedule.yml` and modify the `schedule` field. The system respects manual overrides if they are updated recently.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Verify no unwanted logical changes were made (only formatting, dependencies, snapshots, types).
- [ ] Ensure all CI checks pass.
- [ ] Check that no secrets were accidentally exposed.

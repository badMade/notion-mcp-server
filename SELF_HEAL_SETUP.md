# Self-Heal Automation Setup

This project uses an automated self-healing pipeline to repair codebase drift and CI failures.

## Triggers
- **Scheduled**: Runs proactively based on a telemetry-derived schedule.
- **Reactive**: Runs when the `ci` workflow fails.
- **Manual**: Can be triggered manually via workflow dispatch.

## Repair Pipeline
1. Rebuild/reinstall dependencies
2. Lint/format auto-fix
3. Snapshot updates
4. Type stubs sync
5. Dependency re-resolve
6. Static asset regeneration

## Schedule Configuration
The schedule is computed based on PR and commit telemetry in `scripts/compute_schedule.mjs`.
To manually override, edit `.github/self-heal-schedule.yml` and the cron schedule in `.github/workflows/self-heal.yml`. Ensure to keep the `# AUTO-UPDATED` comment.

## Reviewer Checklist
- [ ] Verify the repairs applied in `src/`, `tests/` or other allowed directories are correct.
- [ ] Confirm no secrets, API keys, or `.env` files are accidentally committed.
- [ ] Check artifact logs in the GitHub Actions run for any underlying healthcheck failures.
- [ ] Verify that schedule updates are consistent with the current development cadence.

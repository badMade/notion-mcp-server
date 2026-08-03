# Self-Heal Coding Agent

This repository includes a self-healing and self-scheduling automation pipeline.

## Triggers
1. **Scheduled**: Runs periodically based on telemetry.
2. **Reactive**: Runs when the `ci` workflow fails.
3. **Manual**: Can be triggered manually via workflow_dispatch.

## Repair Pipeline
- **Step 1**: Rebuild/reinstall (npm ci)
- **Step 2**: Lint/format auto-fix (eslint, prettier)
- **Step 3**: Snapshot/generated updates (vitest -u)
- **Step 4**: Type stubs/analyzer config (typesync)
- **Step 5**: Dependency re-resolve (npm install)
- **Step 6**: Static asset regeneration

## Schedule Override
If you want to override the schedule manually, edit `.github/self-heal-schedule.yml` and the `cron` line in `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- Check the proposed changes.
- Ensure no sensitive data is leaked.
- Verify that it only updates valid scopes (formatting, tests, etc.).

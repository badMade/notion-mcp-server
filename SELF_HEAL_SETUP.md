# Self-Heal Setup

This document describes the Self-Heal Coding Agent setup.

## Steps
1. Rebuild/reinstall (npm ci)
2. Lint/format auto-fix (eslint, prettier)
3. Snapshot/generated updates (vitest run -u)
4. Type stubs/analyzer config (typesync)
5. Dependency re-resolve (npm update)
6. Static asset regeneration (npm run build)

## Self-Scheduling Logic
A workflow runs periodically to calculate PR merge rates and commit times to find the optimal execution window. It edits `.github/self-heal-schedule.yml` and creates a PR to update `.github/workflows/self-heal.yml` safely using the `# AUTO-UPDATED` marker.

## Reviewer Checklist
- Check for secrets in the diff.
- Verify that changes only target the allowlisted directories (src, tests, config files).
- Approve and merge if the fixes are valid and pass CI.

## Override Instructions
To override the schedule, manually edit the `schedule` value in `.github/self-heal-schedule.yml` while keeping the `# AUTO-UPDATED` marker. Ensure the `cron:` field in `.github/workflows/self-heal.yml` reflects the change, or let the compute script handle the sync.

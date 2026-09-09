# Self-Heal Setup

This repository uses an automated self-healing pipeline to repair CI failures and detect drift.

## Triggers
- **Scheduled**: Runs periodically based on telemetry.
- **CI Failure**: Runs when the `ci` workflow fails.
- **Manual**: Can be dispatched manually.

## Repair Steps
1. Rebuild/reinstall
2. Lint/format auto-fix
3. Snapshot updates
4. Type stubs
5. Dependency re-resolve
6. Static asset regeneration

## Schedule
The schedule is computed dynamically based on PR merge frequency and commit times. To override, edit `.github/self-heal-schedule.yml`.

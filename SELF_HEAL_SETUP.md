# Self-Heal Automation Setup

This repository has self-healing auto-repair capabilities to automatically fix configuration and syntax drift.

## Triggers
1. **Scheduled**: Runs periodically based on computed project velocity.
2. **CI Failure**: Runs reactively if the main CI workflow fails.
3. **Manual Dispatch**: Can be manually triggered from the Actions tab.

## Repair Pipeline
1. Rebuild/reinstall (clean install of tooling + deps)
2. Lint/format auto-fix
3. Snapshot/generated updates
4. Type stubs/analyzer config
5. Dependency re-resolve
6. Static asset regeneration

## Self-Scheduling
The schedule is determined based on git commit and PR activity to run proactively during inactive periods.

## Manual Overrides
To override the schedule, manually edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- [ ] Review PR diffs.
- [ ] Check workflow logs if needed.
- [ ] Merge when satisfied.
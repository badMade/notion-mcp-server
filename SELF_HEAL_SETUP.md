# Self-Heal Automation Setup

This repository is equipped with a self-adapting repair automation system.

## Triggers
- **Scheduled**: Runs automatically based on telemetry (see `.github/self-heal-schedule.yml`).
- **Reactive**: Triggers when the `ci` workflow fails.
- **Manual**: Can be triggered manually via workflow dispatch.

## Repair Pipeline
1. Install dependencies
2. Lint and format code
3. Update snapshots
4. Update type definitions
5. Update lockfile
6. Build artifacts

## Customization
To manually override the schedule, update `.github/self-heal-schedule.yml`.

## Reviewer Checklist
- [ ] Review the changes applied by the automated self-heal pipeline.
- [ ] Verify that no unintended logic changes were introduced.
- [ ] Check workflow logs for healthcheck outputs.

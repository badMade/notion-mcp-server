# Self-Heal Automation Setup
This project uses an adaptive self-healing CI pipeline.
## Triggers
- **Scheduled**: Runs automatically based on computed repo activity.
- **CI Failure**: Runs reactively when the `ci` workflow fails.
- **Manual**: Can be triggered via GitHub Actions UI.
## Repair Pipeline Steps
1. **Rebuild/Reinstall**: Installs fresh dependencies.
2. **Lint/Format**: Runs ESLint and Prettier auto-fixes.
3. **Snapshots**: Updates test snapshots.
4. **Typesync**: Updates TypeScript types.
5. **Dependency Re-resolve**: Updates lockfiles.
6. **Static Assets**: Regenerates build artifacts.
## Self-Scheduling
The `compute-schedule.yml` workflow periodically analyzes commit frequency and PR velocity to adjust the schedule of the `self-heal.yml` workflow.
## Customization & Overrides
To manually override the schedule, edit `.github/self-heal-schedule.yml` and commit. The system respects manual updates if telemetry doesn't warrant a tier change.
## Reviewer Checklist
- Review all changes.
- Ensure no sensitive data is exposed.
- Verify tests pass.

# Self-Heal Automation
This automation runs self-healing repair steps on a schedule, CI failure, or manually.
- **Triggers**: Schedule (computed via telemetry), CI Failure, Manual
- **Repair Steps**: Install, Lint, Snapshot, Type stubs, Dependencies, Assets
- **Override**: Modify `.github/self-heal-schedule.yml` to override the schedule.
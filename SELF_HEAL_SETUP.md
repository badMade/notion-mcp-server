# Self-Heal Automation
- **Triggers**: Scheduled, reactive (on CI failure), and manual.
- **Repair Steps**: Dependencies, linting, snapshots, types, lockfile, artifacts.
- **Schedule Logic**: Periodically recomputes based on telemetry.
- **Override**: Edit `.github/self-heal-schedule.yml`.
- **Checklist**: Review artifacts, verify file boundaries.

# Self-Heal Automation Setup

This project uses an automated self-healing pipeline to correct code drift and CI failures.

## Features
- **Triggers**: Scheduled, reactive (on CI failure), and manual.
- **Repair Steps**: Dependencies install, linting, snapshot update, typesync, and build generation.
- **Self-Scheduling**: Periodically computes the ideal schedule based on git telemetry.

## Manual Overrides
To manually set the schedule, edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` to the desired cron expression.

## Reviewer Checklist
- Check the PR diff.
- Verify no secrets were committed.

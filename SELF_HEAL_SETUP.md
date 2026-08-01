# Self-Heal Setup

Provides reactive and proactive self-healing for the project.

## How it works

- **Reactive Repair**: Triggered on CI failures via `workflow_run`.
- **Proactive Repair**: Triggered on a computed schedule.
- **Manual Repair**: Triggered via `workflow_dispatch`.

The repair pipeline includes idempotently executing: Rebuild, lint/format auto-fix, snapshot updates, type syncing, dependency updates, and static asset generation.

## Self-Scheduling

The proactive schedule is determined by analyzing git history to find the most active commit periods and scheduling the job for the quietest window (typically 12 hours offset from the peak).

To manually override the schedule:
Modify `.github/self-heal-schedule.yml` directly.

## Reviewer Checklist

- Confirm the drift fixes are correct and do not introduce unintended logic changes.
- Ensure only the allowed directories are modified (e.g., `src/`, `tests/`, configuration files).
- Check the attached artifact logs (pre and post healthcheck) if any step failed.

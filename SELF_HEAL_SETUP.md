# Self-Heal Setup

This repository is equipped with a self-healing pipeline that automatically triggers upon CI failures, on a schedule, or manually.
It performs idempotent repair steps (reinstall, lint/format, snapshot updates, type syncing, dependency updates) to correct code drift.

## Schedule Configuration
The schedule is automatically re-computed periodically based on PR merge frequency telemetry to optimize runs.
To override this, manually update the schedule in `.github/self-heal-schedule.yml` and the `# AUTO-UPDATED` annotated cron in `.github/workflows/self-heal.yml`.

## Reviewer Checklist
- Review auto-generated PRs carefully.
- Ensure no unintended logical changes occurred.
- Check artifact logs linked in PR descriptions for details on failures and repairs.

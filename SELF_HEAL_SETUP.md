# Self-Heal Setup

## Architecture
This automation computes its own schedule using repository telemetry.
Triggers: scheduled, manual, CI failure.
Steps: Rebuild/reinstall -> Lint -> Snapshots -> Types -> Dependencies -> Assets.

## Overrides
To override, edit `.github/self-heal-schedule.yml`.

## Reviewer Checklist
- Check for unintended changes
- Review artifact logs linked in PR

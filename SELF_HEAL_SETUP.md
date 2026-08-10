# Self-Heal Setup
This repository uses a self-healing automation pipeline to detect drift, auto-repair common issues, and compute its own execution schedule.

## Triggers
1. Scheduled: Runs proactively based on dynamic telemetry computation.
2. CI Failure: Runs reactively when a CI workflow fails.
3. Manual: Can be triggered on-demand via workflow_dispatch.

## Rationale
The initial schedule logic computes cadence dynamically based on git commit volume over a rolling lookback window.

## Override
To override the schedule manually, edit `.github/self-heal-schedule.yml`.

## Reviewer Checklist
- Check for unintended source code changes
- Ensure PR is cleanly formatted
- Review updated dependencies

See chat logs for context.

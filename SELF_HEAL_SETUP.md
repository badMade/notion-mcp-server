# Self-Heal Pipeline

This repository features an automated self-healing pipeline for auto-repairing code drift and CI failures.

## Features
- **Triggers**: It responds to a self-adapting schedule, reactive CI failures, and manual dispatch.
- **Repair**: Idempotent steps re-verify and fix drift without touching internal logic (e.g. typesync, prettier, lockfile).
- **Scheduling**: Periodically re-computes optimal intervals based on GitHub telemetry using `scripts/compute_schedule.mjs`.

## Customization
If you wish to override the schedule, manually edit the schedule in `.github/self-heal-schedule.yml` and the pipeline will respect it.

## Reviewer Checklist
- Always review self-heal PRs for correctness before merging.
- Verify snapshot modifications.
- Check pipeline logs via PR artifact links.
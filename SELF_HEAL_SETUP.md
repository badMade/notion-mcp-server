# Self-Heal Setup

This repository uses an automated self-healing pipeline to fix drift and CI failures.

## Repair Pipeline
The pipeline runs through six idempotent steps:
1. Install Dependencies
2. Lint and Format Auto-fix
3. Snapshot/generated updates
4. Type stubs/analyzer config sync
5. Dependency re-resolve
6. Static asset regeneration

## Schedule
The cadence is re-computed periodically based on PR velocity and commit activity to minimize disruption.

## Manual Overrides
To override the schedule, edit `.github/self-heal-schedule.yml` manually.
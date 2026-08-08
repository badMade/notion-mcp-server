# Self-Heal Setup

This repository is equipped with an automated self-healing CI pipeline.

## Overview
The system consists of three main components:
1. **Triggers**: Scheduled runs, CI failure reactions, and manual dispatch.
2. **Repair Pipeline**: 6 idempotent steps (Rebuild, Lint, Snapshots, Type stubs, Dep re-resolve, Static assets).
3. **Adaptive Scheduling**: Automatically computes the best cadence based on PR velocity and telemetry.

## Schedule Override
The schedule is defined in `.github/self-heal-schedule.yml`. You can manually update this file to override the cadence.

## Reviewer Checklist
When reviewing a `selfheal-*` PR, ensure:
- Unintended logic changes are absent.
- The drift summary aligns with the file changes.
- Secrets and tokens are not accidentally committed.

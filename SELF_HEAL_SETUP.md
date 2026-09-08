# Self-Heal Setup
This project uses an automated self-healing CI/CD pipeline.
## Repair Pipeline
1. Install dependencies
2. Lint and format
3. Update snapshots
4. Sync types
5. Re-resolve lockfile
6. Build artifacts
## Triggers
- **Scheduled**: Runs periodically to detect drift.
- **CI Failure**: Runs reactively if `ci` workflow fails.
- **Manual**: Via workflow dispatch.
## Schedule Computation
The schedule is computed based on telemetry via `scripts/compute_schedule.mjs` and updated via PRs.
## Override
Modify `.github/self-heal-schedule.yml` manually to set a custom schedule.

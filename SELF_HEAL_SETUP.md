# Self-Heal Setup

This project uses an automated self-healing CI pipeline.

## Triggers
- Scheduled
- Reactive (CI Failure)
- Manual Dispatch

## Repair Pipeline
1. Clean install
2. Lint auto-fix
3. Snapshot updates
4. Type sync
5. Lockfile update
6. Static assets

## Customization
You can modify `scripts/self_heal.mjs` and `scripts/compute_schedule.mjs`.

## Manual Override
Edit `.github/self-heal-schedule.yml` directly.

# Self-Heal Pipeline

This repository uses an automated self-healing pipeline to correct code drift (e.g., formatting, snapshots, lockfile sync) and fix CI failures.

## Triggers

1. **Scheduled**: Runs periodically on a cadence that adapts automatically based on repository activity (telemetry).
2. **Reactive**: Runs when the `ci` workflow fails.
3. **Manual**: Can be triggered manually via `workflow_dispatch`.

## How it works

The pipeline runs `scripts/self_heal.mjs` which attempts 6 idempotent repair steps:
1. Rebuild/reinstall (clean dependencies)
2. Lint/format auto-fix
3. Snapshot/generated updates
4. Type stubs/analyzer config update
5. Dependency re-resolve
6. Static asset regeneration

After each step, it runs a strict healthcheck (`scripts/healthcheck.mjs`). If the healthcheck passes and there is a git diff, it stops and opens a Pull Request for human review.

## Adaptive Schedule

The `compute-schedule.yml` workflow runs periodically to analyze commit frequency and adjust the self-heal schedule. It writes the current schedule to `.github/self-heal-schedule.yml` and updates the cron expression in `.github/workflows/self-heal.yml`.

### Manual Override

To manually override the schedule:
1. Edit `.github/self-heal-schedule.yml` and set your desired `schedule`.
2. Edit `.github/workflows/self-heal.yml` and update the `cron:` string (leave the `# AUTO-UPDATED` comment intact).
3. Commit the changes. The script uses an oscillation guard to prevent immediate overrides.

## Reviewer Checklist

When reviewing a self-heal PR, ensure:
- [ ] Changes do not alter core business logic.
- [ ] No secrets or keys are exposed.
- [ ] Snapshots correctly reflect intentional changes.
- [ ] Dependencies have not introduced breaking regressions.

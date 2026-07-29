# Self-Heal Pipeline Setup

This repository is equipped with an automated Self-Heal pipeline designed to fix simple build, linting, or formatting drift.

## How It Works

The self-heal system is triggered by three events:

1. **Scheduled Runs:** Computes an automated schedule based on repository PR and commit activity.
2. **Reactive:** Automatically triggers if the `ci` workflow fails.
3. **Manual:** Can be triggered manually via Workflow Dispatch.

### The Repair Pipeline

The pipeline runs through an idempotent series of repairs (defined in `scripts/self_heal.mjs`):

1. **Rebuild/reinstall**: Cleans dependencies using `npm ci`.
2. **Lint/format auto-fix**: Attempts to automatically fix any linting or formatting problems.
3. **Snapshot updates**: Runs Vitest to update any outdated snapshots.
4. **Dependency re-resolve**: Updates dependencies to resolve conflicts.

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes, it commits the changes and opens a PR.

### Self-Scheduling

The schedule updates itself using a telemetry job (`scripts/compute_schedule.mjs`). It reads commit logs and classifies the repository's tier:

- **High / Active:** Frequent PRs / High Velocity. Runs up to every 6 or 12 hours.
- **Standard:** Runs daily.
- **Low-churn / Dormant:** Low PR volume. Runs weekly or monthly.

It automatically opens PRs to adjust the cadence if the velocity changes significantly.

## How to override the schedule manually

You can adjust the schedule by modifying `.github/self-heal-schedule.yml` and updating the cron expression. Be sure to use standard cron formats, and to preserve quotes for safely parsing via JS YAML. Note: Automatic updates may recalculate this if velocity changes.

## Reviewer Checklist for Self-Heal PRs

When reviewing a self-heal PR:

- [ ] Check the changed files list: Is it only formatting, snapshots, and `package-lock.json` changes?
- [ ] Ensure that no application logic was modified.
- [ ] Review the Action's artifact logs to see exactly which step fixed the pipeline.
- [ ] Approve and merge once CI tests pass successfully.

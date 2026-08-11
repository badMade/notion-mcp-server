# Self-Healing CI Pipeline Setup

This repository has been configured with an automated self-healing CI pipeline designed to detect and fix common issues like drift (formatting, types, missing snapshots) and failing builds.

## How it works

The automation is powered by three main scripts and two GitHub Actions workflows:

1. **`scripts/healthcheck.mjs`**: An idempotent healthcheck script that verifies lint, types, tests, and build. Exits 0 on success, 1 on failure.
2. **`scripts/self_heal.mjs`**: A 6-step idempotent repair script:
    - Step 1: Rebuild/reinstall dependencies
    - Step 2: Lint/format auto-fix
    - Step 3: Snapshot/generated updates
    - Step 4: Type stubs/analyzer config sync
    - Step 5: Dependency lockfile refresh
    - Step 6: Static asset regeneration
    It evaluates the healthcheck after each step. If it passes *and* creates a git diff, it exits with 0, meaning a fix was found.
3. **`scripts/compute_schedule.mjs`**: A telemetry-based schedule optimization script.

### Triggers

The self-healing pipeline (`.github/workflows/self-heal.yml`) runs on three triggers:
*   **Reactive**: Runs on `ci` workflow failure.
*   **Proactive**: Runs on a scheduled cron cadence.
*   **Manual**: Can be triggered manually via `workflow_dispatch`.

When the pipeline runs, it will execute the repair scripts. If it successfully finds a fix and generates a diff, it will *not* push to `main` directly. Instead, it will create a Pull Request with the `automation` and `self-heal` labels for a human to review.

### Self-Scheduling Explanation

To avoid wasting CI minutes on dormant repositories and to quickly catch drift on active ones, the pipeline automatically adjusts its scheduled cadence.

The `compute-schedule.yml` workflow periodically looks at repository activity (like PR merges and commit frequency) and determines the best schedule. It analyzes the "mode of inactivity" (the quietest time based on commit history) and schedules runs right before that.

If the cadence needs to change, it automatically generates a PR to update `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

### Reviewer Checklist

When reviewing a `selfheal-*` PR:
- [ ] Verify the changes make sense and do not negatively impact logic.
- [ ] Ensure the PR only touches approved areas (e.g., formatting, snapshots, `package.json`).
- [ ] Approve and merge once CI passes on the PR branch.

### Manual Override

If you want to disable or manually override the auto-computed schedule, you can manually modify the `schedule` value inside `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml`. Ensure you do not change the `# AUTO-UPDATED` marker if you want the automation to be able to pick it up again. If you wish to disable the auto-updates completely, you can disable the `compute-schedule.yml` workflow via GitHub's UI.

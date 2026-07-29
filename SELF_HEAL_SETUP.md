# Self-Heal Automation Setup

This project uses an automated self-healing CI pipeline designed to detect code drift, repair formatting issues, and maintain project health autonomously.

## Triggers

The system reacts to three different triggers:

1.  **Scheduled:** A proactive run that executes periodically based on the repository's activity level (telemetry).
2.  **Reactive (CI Failure):** Runs automatically if a run on the main `ci` workflow fails.
3.  **Manual Dispatch:** Can be triggered manually via the GitHub Actions UI.

## Self-Scheduling

The pipeline features a self-adapting schedule computing engine (`scripts/compute_schedule.mjs`). It analyzes recent commit velocity and adjusts the `cron` schedule dynamically.

*   If the repository has high activity, the pipeline runs more frequently (e.g., every 4 hours).
*   If dormant, it steps down (e.g., weekly) to save CI minutes.

### How to Manually Override the Schedule

If you want to freeze the schedule, you can edit `.github/self-heal-schedule.yml` directly. Note that if you do this, you might also want to disable the `compute-schedule.yml` workflow, as it will continually try to correct it back based on telemetry unless modified.

## Repair Pipeline Steps

When triggered and unhealthy, `scripts/self_heal.mjs` executes six idempotent repair steps:

1.  **Rebuild/reinstall:** Runs `npm ci` or `npm install` for a clean install.
2.  **Lint/format auto-fix:** Runs `npx eslint --fix .` and `npx prettier --write .`
3.  **Snapshot updates:** Runs `npx vitest run -u` to update test snapshots.
4.  **Dependency re-resolve:** Runs `npm update`.

After each step, it runs a health check (`scripts/healthcheck.mjs`). The pipeline exits successfully immediately when the check passes *and* there is an allowed file diff.

## Reviewer Checklist

When reviewing a PR prefixed with `[Self-Heal...]`, please check:

- [ ] Does the diff look correct? Check for formatting corrections and updated package lockfiles.
- [ ] Are there any unintended changes to logic? (The agent is strictly forbidden from changing source logic, but it's worth verifying).
- [ ] Are there any leaked secrets?
- [ ] For `[Self-Heal Schedule]` PRs, does the new frequency make sense for the current velocity?

Once reviewed, merge the PR! The self-healing loop prevents loops from its own branches.

# Self-Healing Pipeline Setup

This project utilizes an automated self-healing CI pipeline to detect and repair codebase drift (like formatting issues, un-updated snapshots, missing type stubs, lockfile drift, or missing compiled assets).

## Architecture & Workflow

The architecture is driven by an idempotent pipeline consisting of multiple repair steps that attempt to fix the codebase.

1. **`scripts/healthcheck.mjs`**: A strict gatekeeper script that runs linting, type-checking, and tests. It verifies if the repository state is green.
2. **`scripts/self_heal.mjs`**: An idempotent script that performs multiple steps to fix common CI failures (e.g. `npm ci`, `eslint --fix`, `vitest -u`). It creates logs and exits successfully only if the state is green and there are file diffs to commit.
3. **`scripts/compute_schedule.mjs`**: Evaluates telemetry data like commit and PR frequencies to intelligently scale the frequency of scheduled proactive self-heal runs up or down based on repository activity.

## Triggers

The system has three triggers to initiate the self-healing workflow:
1. **Scheduled (Proactive)**: Runs periodically based on a cadence determined by historical telemetry.
2. **CI Failure (Reactive)**: When the `ci` workflow fails on the default branch, the self-heal process reacts by attempting fixes.
3. **Manual Dispatch**: Can be triggered manually at any point from the GitHub Actions tab.

## Self-Scheduling Logic
The `compute-schedule.yml` action periodically evaluates git telemetry (merge frequency, commit activity hours) via `scripts/compute_schedule.mjs` to adjust the frequency of scheduled runs dynamically.
The system defines varying tiers (`high`, `active`, `standard`, `low-churn`, `dormant`) based on velocity and adjusts the `.github/workflows/self-heal.yml` accordingly.

### Manual Overrides
If you need to manually configure the schedule, you can override the automation:
1. Open `.github/self-heal-schedule.yml` and modify the `cron` value to your preferred schedule. Update the `last_updated` field to today.
2. Open `.github/workflows/self-heal.yml` and replace the cron string on the line marked `# AUTO-UPDATED`.
3. *(Optional)* Disable the `compute-schedule.yml` workflow if you want to permanently disable auto-scaling frequency.

## Reviewer Checklist for Self-Heal PRs
When a Self-Heal PR is created, reviewers should verify:
- [ ] Review the `pre-check.log` and `repair.log` artifacts attached to the workflow run.
- [ ] Ensure that code logic hasn't been improperly altered (the automation strictly avoids this, but it's crucial for human oversight).
- [ ] Confirm no secrets or unintended environment variables have been introduced.
- [ ] Ensure the diff applies cleanly to the targeted areas (snapshots, lockfiles, formatting).

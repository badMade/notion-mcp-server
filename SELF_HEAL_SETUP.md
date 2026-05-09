# Self-Heal CI Automation

This repository includes an automated "Self-Heal" CI pipeline designed to detect code drift (like formatting issues, outdated lockfiles, or missing types) and automatically open a Pull Request to fix them.

## Triggers

The automation runs based on three triggers:
1. **Scheduled:** Runs on a self-computed interval based on the repository's recent activity.
2. **Reactive:** Runs whenever the `ci` workflow fails on the default branch.
3. **Manual:** Can be manually triggered via `workflow_dispatch` in the GitHub Actions tab.

## The 6 Repair Steps

The core script (`scripts/self_heal.mjs`) attempts to repair drift via a sequence of 6 idempotent steps:

1. **Rebuild/reinstall:** Runs `npm ci` to ensure a clean state.
2. **Lint/format auto-fix:** Runs `prettier` to format code.
3. **Snapshot/generated updates:** Runs `vitest run -u` to update test snapshots.
4. **Type stubs/analyzer config:** Runs `typesync` to add missing `@types/*` dependencies.
5. **Dependency re-resolve:** Runs `npm install` to update `package-lock.json`.
6. **Static asset regeneration:** Runs `npm run build` to generate build artifacts like `cli.mjs`.

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes and there is a git diff, a PR is created and the process stops.

## Self-Scheduling Explanation

The frequency of the scheduled runs is adaptive. A separate workflow (`compute-schedule.yml`) runs weekly to count the number of commits in the last 30 days. Based on this telemetry, it assigns a tier:

* **High (>100 commits):** Every 6 hours
* **Active (>30 commits):** Every 12 hours
* **Standard (>10 commits):** Daily
* **Low-churn (>0 commits):** Weekly
* **Dormant (0 commits):** Monthly

If the schedule tier changes, it automatically opens a PR to update the CRON expression in `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

## How to Manually Override the Schedule

If you want to manually set the schedule:
1. Edit the `cron:` value in `.github/self-heal-schedule.yml`
2. Update the corresponding `- cron:` line under `schedule` in `.github/workflows/self-heal.yml` (located right under the `# AUTO-UPDATED` comment).
3. The automated scheduler will respect your changes until the tier needs to be adjusted based on activity.

## Reviewer Checklist for Self-Heal PRs

When reviewing a PR created by `github-actions[bot]`:
- [ ] Ensure the diff is logical (e.g., just formatting, lockfile updates, or snapshot changes).
- [ ] Confirm no secrets, tokens, or PII were accidentally added.
- [ ] Check the Actions tab to verify the CI passes on the PR branch.
- [ ] Approve and merge.

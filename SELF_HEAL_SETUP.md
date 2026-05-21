# Self-Heal Auto-Repair Automation

This project uses an automated self-healing CI pipeline configured via GitHub Actions.

## Triggers

1. **Scheduled:** Proactively runs to detect and repair drift. The schedule is dynamically computed based on the repository's activity level.
2. **CI Failure (Reactive):** Triggers when the main `ci` workflow fails. It attempts to repair the build and opens a PR if it succeeds.
3. **Manual Dispatch:** Can be run on demand from the Actions tab.

## The Repair Pipeline (Idempotent)

The `scripts/self_heal.mjs` script performs the following idempotent steps to resolve issues:
1. **Clean Install:** Runs `npm ci` to rebuild tools and lock dependencies to the lockfile.
2. **Lint/Format:** Uses `eslint --fix` and `prettier -w` to automatically format the code.
3. **Test Snapshots:** Runs `vitest -u` to update any failing test snapshots.
4. **Clean Rebuild:** Wipes out previous TypeScript typestubs (e.g., `tsbuildinfo`) and does a clean build to clear out cache issues.
5. **Dependency Re-resolve:** Refreshes lockfiles cleanly if needed.
6. **Static Build:** Re-runs the final build scripts to regenerate static assets.

After each step, it runs a healthcheck (`scripts/healthcheck.mjs`). If the healthcheck passes and there's a git diff, it stops immediately, exits successfully, and the GitHub Action creates a PR with the fixes.

## Schedule Dynamics

The schedule is controlled by `.github/self-heal-schedule.yml` and computed by `.github/workflows/compute-schedule.yml` (using `scripts/compute_schedule.mjs`). It reads telemetry via the GitHub API (`gh pr list`) and scales the run frequency based on PR velocity (e.g., High velocity = runs every 6 hours; Low velocity = runs weekly).

## How to Override the Schedule

To manually override the schedule:
1. Edit `.github/self-heal-schedule.yml` directly.
2. Ensure the first line is exactly `# AUTO-UPDATED`.
3. The next compute cycle will see your changes. If you wish to freeze it completely, disable the `compute-schedule.yml` workflow.

## Reviewer Checklist

When reviewing a PR from this automation, check:
- [ ] Has it unintentionally altered test assertions or logic? (Only snapshots and formatting are expected).
- [ ] Has it modified restricted files like `.github/workflows/ci.yml` or leaked secrets? (It shouldn't, there are gates preventing it).
- [ ] Is it a legitimate repair of code drift or an unexpected artifact change?

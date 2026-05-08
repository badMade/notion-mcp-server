# Self-Heal Automation Setup

This repository is configured with a self-adapting repair automation system. It automatically attempts to fix code drift, linting errors, missing types, and test snapshots.

## Triggers

1. **Scheduled:** Runs periodically on the default branch. The schedule adapts based on project velocity.
2. **Reactive (CI Failure):** Runs automatically if the main `ci` workflow fails on the default branch.
3. **Manual Dispatch:** Can be triggered manually via the GitHub Actions UI.

## Self-Scheduling Logic

The `compute-schedule.yml` workflow runs periodically to analyze the repository's commit and PR velocity over a rolling window. It assigns the repository to a cadence tier (High, Active, Standard, Low/Dormant) and calculates an optimal cron expression.

The computed schedule is written to `.github/self-heal-schedule.yml`, and `.github/workflows/self-heal.yml` is automatically updated via a Pull Request.

## Repair Steps

The self-healing process is strictly idempotent and executes the following sequence:

1.  **Rebuild/reinstall:** `npm ci` ensures a clean dependency state.
2.  **Lint/format auto-fix:** `npx prettier -w src scripts` fixes code formatting.
3.  **Snapshot/generated updates:** `npx vitest run -u` updates test snapshots.
4.  **Type stubs/analyzer config:** `npm run build` compiles TypeScript and ensures types are sound.
5.  **Dependency re-resolve:** `npm install --package-lock-only` refreshes the lockfile.
6.  **Static asset regeneration:** (Placeholder for future assets like docs/badges).

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes AND a `git diff` is detected, the script exits successfully, and a PR is created.

## Manual Override

To manually override the self-healing schedule:

1.  Edit `.github/self-heal-schedule.yml` and set your desired `schedule`.
2.  Edit `.github/workflows/self-heal.yml` and replace the cron string on the line marked `# AUTO-UPDATED`.
3.  Commit and push to `main`.

*(Note: Future compute-schedule runs may still attempt to update this if velocity changes drastically, but you can always override it again.)*

## Reviewer Checklist

When reviewing a `[Self-Heal]` Pull Request:
- Verify that no unintended logic changes were introduced (only formatting, snapshots, or lockfile changes).
- Check that no sensitive information (secrets, API keys) was accidentally committed (the workflow attempts to gate this, but human review is final).
- Ensure the tests and build pass on the PR branch.

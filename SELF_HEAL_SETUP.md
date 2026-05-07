# Self-Heal Automation Setup

This project uses an automated self-healing CI pipeline configured via GitHub Actions.

## Triggers
The self-healing pipeline is triggered by:
1. **Scheduled Runs:** Runs on an adaptive schedule based on repository telemetry.
2. **CI Failure:** Automatically triggered when the main CI workflow fails.
3. **Manual Dispatch:** Can be manually triggered via the GitHub Actions UI.

## Self-Scheduling Logic
The `compute-schedule.yml` workflow periodically evaluates project telemetry (like PR and commit frequency) to determine the optimal schedule for the self-healing pipeline.
This ensures it runs more often during active development and less often when the repository is inactive. The current schedule is recorded in `.github/self-heal-schedule.yml`.

To manually override the schedule:
1. Update `.github/self-heal-schedule.yml` with your desired cron schedule and rationale.
2. Update the cron expression in `.github/workflows/self-heal.yml`.
Note: The auto-updater will preserve `# AUTO-UPDATED` markers. You may need to manually pause `compute-schedule.yml` if you want a permanent override.

## Repair Pipeline Steps
The `scripts/self_heal.mjs` script performs the following idempotent steps:
1. Rebuild/reinstall (`npm install`)
2. Lint/format auto-fix (`npx prettier -w .`)
3. Snapshot/generated updates (`npx vitest run -u`)
4. Type stubs/analyzer config (`npx typesync && npm install`)
5. Dependency re-resolve (`npm update`)
6. Static asset regeneration (`npm run build`)

After each step, a health check (`scripts/healthcheck.mjs`) is run. If the health check passes and there is a git diff, a pull request is automatically created.

## Safety Gates
Before self-healing is allowed, it must pass a number of safety gates, checking that:
- It only modifies files in expected directories.
- No unexpected secrets or credentials are included in the diff.
- A legitimate change exists that successfully passes the healthcheck test pipeline.

## Reviewer Checklist
When reviewing a self-heal PR, ensure:
- The changes make sense and correctly resolve the drift/failure.
- No unintended side effects or regressions are introduced.
- Tests still pass locally.

# Self-Heal Coding Agent Workflow

This repository includes an automated self-healing CI pipeline configured via GitHub Actions. It is designed to automatically repair code drift, fix linting and formatting issues, update test snapshots, and correct dependency resolution issues without requiring a human intervention for routine maintenance.

## Architecture

1. **`scripts/healthcheck.mjs`**: The foundational gate. Verifies if the system passes types, tests, and builds successfully.
2. **`scripts/self_heal.mjs`**: The repair automation script. Executes a 6-step idempotent repair process (Install -> Format -> Snapshots -> Types -> Deps -> Assets), checking health between each step.
3. **`scripts/compute_schedule.mjs`**: The self-scheduling automation. Gathers repository telemetry (commit history) over a 30-day window to compute an optimal repair cadence.
4. **`.github/workflows/self-heal.yml`**: The main workflow. Triggers the repair pipeline based on the computed schedule, any CI failure (`workflow_run`), or manual dispatch. Safely creates a Pull Request with the repairs.
5. **`.github/workflows/compute-schedule.yml`**: A periodic workflow that re-computes the optimal self-heal schedule using telemetry.
6. **`.github/self-heal-schedule.yml`**: Contains metadata about the current schedule configuration.

## Repair Pipeline Steps

The `scripts/self_heal.mjs` script performs the following idempotent steps:
1. **Rebuild/reinstall**: Cleans and installs tooling and dependencies (`npm ci`).
2. **Lint/format auto-fix**: Attempts to run ESLint with autofix and Prettier (`npx eslint --fix` and `npx prettier -w`).
3. **Snapshot/generated updates**: Updates Vitest snapshots (`npx vitest run -u`).
4. **Type stubs/analyzer config**: Installs or regenerates necessary types (`npm install`).
5. **Dependency re-resolve**: Resolves dependency updates (`npm update`).
6. **Static asset regeneration**: Runs the build command to generate assets (`npm run build`).

## Self-Scheduling

The scheduling process is completely autonomous:
- Commit volume dictates the cadence. High churn leads to frequent checks, low churn leads to infrequent checks (up to weekly).
- If you need to manually override the schedule, you can safely modify `.github/self-heal-schedule.yml`.

## Manual Override / Troubleshooting
- **To manually trigger self-heal**: Navigate to the Actions tab on GitHub, select "Self-Heal Pipeline", and click "Run workflow".
- **If self-heal keeps failing**: Review the generated PR and `self-heal` logs. The pipeline gracefully exits if it cannot fully fix an issue.

## Reviewer Checklist
When reviewing a self-heal PR:
- [ ] Ensure the diff does not contain any leaked secrets or environment variables.
- [ ] Review any snapshot updates to verify they reflect expected changes.
- [ ] Confirm no substantive business logic has been inadvertently altered.

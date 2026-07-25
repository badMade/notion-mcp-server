# Self-Heal Automation Setup

This repository is equipped with an adaptive self-healing CI pipeline designed to automatically detect drift, correct lint/formatting errors, update test snapshots, and fix missing types.

## Components

- **`scripts/healthcheck.mjs`**: Verifies that the project builds, passes linter checks, and passes all tests. Fails closed on any error.
- **`scripts/self_heal.mjs`**: Contains idempotent repair steps (reinstall, lint/format, snapshot updates, type sync, dependency resolve, and build). Runs the healthcheck after each step, exiting early if fixed.
- **`scripts/compute_schedule.mjs`**: Reads Git commit telemetry to adaptively compute a CRON schedule based on repository activity levels.
- **`.github/workflows/self-heal.yml`**: Triggers proactively on the computed schedule, reactively upon CI failures, or manually. Applies fixes, verifies them, and opens a PR for human review.
- **`.github/workflows/compute-schedule.yml`**: Periodically re-evaluates and updates the repair schedule.

## Repair Pipeline Details

1. **Rebuild/reinstall**: `npm ci`
2. **Lint/format auto-fix**: `npx eslint --fix .` and `npx prettier -w .`
3. **Snapshot/generated updates**: `npx vitest run -u`
4. **Type stubs update**: `npx --yes typesync` and `npm install`
5. **Dependency re-resolve**: `npm update`
6. **Static asset regeneration**: `npm run build`

## Manual Overrides & Review

- **Reviewing PRs**: All auto-generated repairs are proposed via Pull Request. A human must review the generated diff to ensure logical correctness, particularly for updated test snapshots.
- **Changing the Schedule**: You can manually update the `schedule` property in `.github/self-heal-schedule.yml`. Note that `compute_schedule.mjs` is designed to adjust this based on telemetry, but setting it will take precedence until the next major activity shift.

## Security Safeguards

- Does not push directly to the default branch (only opens PRs).
- Scans diffs for potential exposed secrets before opening PRs.
- Avoids infinite trigger loops by ignoring branches prefixed with `selfheal-`.
- Validates schedule updates securely using strict YAML parsing constraints.

# Self-Heal Setup

This project uses an automated self-healing pipeline to fix code drift, typing issues, and formatting problems.

## Triggers
- **Scheduled**: Runs periodically based on a computed schedule from repository telemetry.
- **Reactive**: Triggers when the main CI workflow fails on `main`.
- **Manual**: Can be triggered manually via `workflow_dispatch`.

## How it works
1. **Compute Schedule**: The `compute-schedule.yml` workflow analyzes telemetry (commits, PR frequency) and writes the optimal schedule to `.github/self-heal-schedule.yml`. This also updates `self-heal.yml`.
2. **Self-Heal Pipeline**: The `self-heal.yml` workflow runs when triggered. It delegates to `scripts/self_heal.mjs` which performs idempotent repair steps (reinstall, lint/format, snapshots, typesync, deps update, static assets).
3. **Healthcheck**: Before and after repairs, `scripts/healthcheck.mjs` runs. If the healthcheck passes and there is a diff, a PR is automatically generated.

## Manual Schedule Override
To override the auto-computed schedule:
1. Open `.github/self-heal-schedule.yml`.
2. Change the `schedule` value to your desired cron string.
3. Update `last_updated` to the current time.
4. Open `.github/workflows/self-heal.yml` and modify the cron schedule string on the line that ends with `# AUTO-UPDATED`.

## Reviewer Checklist
When reviewing a self-heal PR, ensure:
- [ ] No logic changes were introduced.
- [ ] No secrets, tokens, or PII are exposed in the diff.
- [ ] Changes are limited to formatting, imports, type annotations, snapshots, dependencies, or generated assets.
- [ ] CI checks pass on the self-heal PR.
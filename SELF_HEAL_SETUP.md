# Self-Heal Automation Setup

This project uses an automated self-healing CI pipeline designed to auto-repair linting issues, update snapshots, re-resolve dependencies, and fix typing errors automatically.

## Triggers

The self-heal pipeline is triggered by:
1. **Scheduled Runs:** Computes and triggers a job based on the quietest hour deduced from telemetry.
2. **Reactive (CI failure):** Triggers when the main `ci` workflow fails.
3. **Manual Dispatch:** Can be manually started via the GitHub Actions tab.

## Telemetry & Self-Scheduling
The `compute_schedule.mjs` script runs periodically (weekly) to analyze Git commit history. It identifies the hours with the lowest activity to minimize disruptions and automatically updates `.github/self-heal-schedule.yml` and the inline cron schedule in `.github/workflows/self-heal.yml`.

## Repair Pipeline Steps
When triggered, `self_heal.mjs` runs these idempotent steps:
1. Rebuild/reinstall (`npm ci`)
2. Lint/format auto-fix (`eslint --fix` & `prettier -w`)
3. Snapshot updates (`vitest run -u`)
4. Type stubs (`typesync`)
5. Dependency re-resolve (`npm update`)
6. Static asset regeneration (`npm run build`)

After each step, a health check runs. If healthy and there's a diff, it safely commits the change and creates a PR.

## Reviewer Checklist
When reviewing a `[Self-Heal]` PR:
- [ ] Check `pre-check.log` and `repair.log` artifacts to understand what was broken and how it was fixed.
- [ ] Verify that no business logic was fundamentally altered.
- [ ] Approve and merge if all checks pass.

## Overriding Schedule
To manually override the self-computed schedule, update `.github/self-heal-schedule.yml` and the `# AUTO-UPDATED` cron line in `.github/workflows/self-heal.yml`.

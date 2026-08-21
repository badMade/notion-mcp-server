# Self-Heal Setup

This repository is equipped with an automated self-healing CI pipeline designed to adapt to project velocity and automatically propose drift corrections.

## Triggers

1. **Scheduled:** Runs proactively based on a computed schedule to catch drift (e.g., dependency updates, typesync).
2. **Reactive (CI Failure):** Runs automatically when the primary `ci` workflow fails.
3. **Manual Dispatch:** Can be run on demand via the GitHub Actions UI.

## The Repair Pipeline

When triggered, the pipeline sequentially executes an idempotent sequence of repair steps via `scripts/self_heal.mjs`:
1. Rebuild/reinstall (`npm ci`)
2. Lint/format auto-fix (`eslint`)
3. Snapshot/generated updates (`vitest -u`)
4. Type stubs/analyzer config (`typesync`)
5. Dependency re-resolve (`npm install`)
6. Static asset regeneration (`npm run build`)

After each step, it runs a healthcheck (`scripts/healthcheck.mjs`). If the healthcheck passes and files were modified, it exits early and generates a Pull Request for human review.

## Self-Scheduling Logic

The proactive schedule is not static. A secondary workflow (`compute-schedule.yml`) evaluates project telemetry (PR frequency, CI failures) to compute an optimal run frequency. The active schedule is stored in `.github/self-heal-schedule.yml`.

### Manual Overrides

To manually override the schedule, update `.github/self-heal-schedule.yml` directly, but ensure the `schedule` property maintains the `# AUTO-UPDATED` inline comment to anchor the regex mutator safely.

## Reviewer Checklist

When reviewing a self-heal PR:
- [ ] Verify modifications do not alter underlying application logic.
- [ ] Review artifact logs attached to the PR if necessary.
- [ ] Ensure no unintended files (secrets, environments) are modified.

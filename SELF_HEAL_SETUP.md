# Self-Heal Auto-Repair Setup

This system includes 3 scripts and 2 GitHub Actions workflows:
- `scripts/healthcheck.mjs`: Tests project health.
- `scripts/self_heal.mjs`: Runs repair steps iteratively.
- `scripts/compute_schedule.mjs`: Dynamically adjust schedule based on telemetry.

**Triggers**:
1. Scheduled runs (via `compute_schedule.mjs`).
2. Reactive on CI failures.
3. Manual dispatch.

**Overrides**:
To manually override the schedule, edit `.github/self-heal-schedule.yml` and `.github/workflows/self-heal.yml` `cron` line (keep `# AUTO-UPDATED`).

**Reviewer Checklist**:
- Review changes carefully.
- Ensure no sensitive data is leaked.
- Check artifact logs linked in the PR.
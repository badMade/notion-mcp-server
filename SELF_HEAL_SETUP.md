# Self-Healing Pipeline Setup

This project utilizes an automated self-healing pipeline designed to detect code drift, repair formatting/linting issues, update snapshots, and fix other CI regressions autonomously via GitHub Actions.

## How It Works

The system operates using 3 distinct trigger modes:
1. **Scheduled:** Proactively runs on an adaptive cadence determined by commit and PR velocity telemetry.
2. **Reactive:** Automatically triggered when the primary `ci` workflow fails.
3. **Manual:** Can be manually dispatched from the GitHub Actions tab.

When triggered, it runs `scripts/self_heal.mjs` which follows an idempotent, strict 6-step repair pipeline:
1. Rebuild & Reinstall dependencies (`npm ci`)
2. Lint / Format Auto-fix (`eslint --fix` & `prettier -w`)
3. Snapshot updates (`vitest run -u`)
4. Type stubs synchronization (`typesync` + `npm install`)
5. Dependency re-resolve (`npm update`)
6. Static Asset Regeneration (`npm run build`)

After each step, a health check (`scripts/healthcheck.mjs`) is run. If the health check passes and a git diff exists, the pipeline immediately halts and generates a Pull Request with the fixes.

## Self-Scheduling Logic

The `compute-schedule.yml` workflow periodically (weekly) runs `scripts/compute_schedule.mjs`. This script:
- Analyzes git log telemetry to find your team's most active times.
- Determines an activity tier (e.g. high, active, standard, dormant).
- Computes an optimal cron schedule to run right before your most active hour.
- Safely modifies `.github/workflows/self-heal.yml` inline to apply the new schedule and opens a PR if it changed.

### Manual Overrides
To permanently or temporarily override the schedule:
1. Edit `.github/self-heal-schedule.yml`.
2. Update the `schedule` string to your desired cron expression.
3. Manually modify `.github/workflows/self-heal.yml` to match the exact same cron expression inline at the `# AUTO-UPDATED` marker.
The script includes an oscillation guard and will respect recent overrides.

## Reviewer Checklist for Self-Heal PRs

When reviewing a PR opened by the self-healing bot, please ensure:
- [ ] No unintended functional code logic was altered.
- [ ] No secrets or sensitive keys were committed (there are safeguards, but human review is necessary).
- [ ] The modifications to `package.json` or `package-lock.json` are expected and don't introduce breaking changes to dependencies.
- [ ] The test snapshot updates are accurate.
- [ ] Review the artifact logs (`repair.log`, `pre-check.log`, `post-check.log`) attached to the PR for context.

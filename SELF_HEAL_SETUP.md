# Self-Heal Coding Agent Setup

This repository has a self-healing pipeline that automatically detects drift or failures and auto-creates repair PRs.

## Triggers
1. **Scheduled**: Re-evaluated via `compute_schedule.mjs`.
2. **CI Failure**: Triggers upon failure in the main CI.
3. **Manual**: Can be run on demand.

## Auto-Repair Steps
1. Rebuild/reinstall: `npm ci`
2. Lint/format auto-fix: ESLint + Prettier
3. Snapshot updates: Vitest updates
4. Type stubs: Typesync
5. Dependency re-resolve: `npm update`
6. Static asset regeneration: `npm run build`

## Schedule Overrides
To override, edit `.github/self-heal-schedule.yml` or manually trigger the Compute Schedule workflow.

## Reviewer Checklist
- [ ] Check logs linked in the PR.
- [ ] Validate changes are localized and not modifying logic.
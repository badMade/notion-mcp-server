# Self-Heal Auto-Repair System

This system provides an automated pipeline for self-healing minor code drift, fixing CI failures, and adapting its own execution schedule based on repository activity.

## Step Explanations

The repair pipeline runs the following idempotent steps sequentially:
1. **Rebuild/Reinstall (`npm ci`)**: Cleans and installs tooling and dependencies to ensure a deterministic environment.
2. **Lint/Format Auto-fix (`npx eslint --fix . && npx prettier -w .`)**: Enforces code style, fixes formatting issues, and auto-corrects simple linting violations.
3. **Snapshot Updates (`npx vitest run -u --passWithNoTests`)**: Updates test snapshots if underlying output has changed.
4. **Type Stubs (`npx typesync`)**: Acquires missing `@types/*` dependencies for TypeScript.
5. **Dependency Re-resolve (`npm install`)**: Restores package-lock.json and reinstalls if dependency resolution was problematic.
6. **Static Asset Regeneration (`npm run build`)**: Re-builds any generated output necessary for a healthy state.

If any step passes the internal healthcheck AND yields a git diff, the script immediately stops and opens a PR.

## Self-Scheduling Explanation

The `compute_schedule.mjs` script acts as telemetry-based adaptive scheduling. It regularly analyzes the repository's commit velocity over the preceding 30 days and dynamically calculates the most appropriate cadence. This prevents automation thrashing during dormant periods while providing rapid feedback during highly active development phases.
- High activity: Checks every 4 hours.
- Active: Checks twice daily.
- Standard: Checks daily.
- Low/Dormant: Checks weekly.

## Override Instructions

If you need to manually force a specific schedule or bypass the dynamic calculation, you can manually modify `.github/self-heal-schedule.yml`. If the configuration is edited manually, it resets the internal oscillation guard. You can also directly invoke the `workflow_dispatch` trigger in GitHub Actions.

## Reviewer Checklist

When reviewing a `[Self-Heal *]` PR, verify:
- [ ] Ensure the fix is isolated and makes logical sense.
- [ ] Review the artifact logs (attached to the run) to verify the healthcheck failure/success trajectory.
- [ ] Ensure no secret, PII, or unintended API keys were accidentally captured or stored.
- [ ] Verify there is no unintentional functional regression caused by auto-fixed formats or imports.
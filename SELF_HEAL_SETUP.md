# Self-Heal Automation Setup

This project uses an automated self-healing pipeline to resolve CI failures and address repository drift. The system is designed to compute its own cadence based on telemetry and will automatically generate a pull request when it finds fixes for issues.

## Repair Pipeline
The self-healing repair script `scripts/self_heal.mjs` executes 6 idempotent steps in order:
1. **Rebuild/reinstall**: Cleans and installs tooling + dependencies (`npm ci --legacy-peer-deps`).
2. **Lint/format auto-fix**: Runs `eslint --fix` and `prettier -w`.
3. **Snapshot updates**: Updates test snapshots via `vitest run -u`.
4. **Type stubs**: Analyzes missing types using `typesync`.
5. **Dependency re-resolve**: Refreshes the lockfile (`npm install --legacy-peer-deps`).
6. **Static asset regeneration**: Builds the artifacts (`npm run build`).

After each step, a healthcheck (`scripts/healthcheck.mjs`) is run. If the healthcheck passes and the step produced a non-empty git diff (ignoring logs), the process exits early and prepares a pull request.

## Self-Scheduling

The pipeline uses telemetry (recent commits and PRs) to determine how frequently the automated repair process should run proactively.
- High velocity (many commits/PRs) -> Runs every 6 hours
- Active -> Runs every 12 hours
- Standard -> Runs daily
- Low-churn -> Runs twice a week
- Dormant -> Runs monthly

The script `scripts/compute_schedule.mjs` is executed via the `.github/workflows/compute-schedule.yml` workflow to continuously re-evaluate the repository's needs.

## Triggers
1. **Scheduled**: Proactive runs based on the telemetry cadence.
2. **CI Failure**: Reactive runs triggered immediately following any failure in the main "ci" workflow.
3. **Manual Dispatch**: Humans can manually trigger the workflow from the Actions tab.

## Reviewer Checklist
Before merging a self-heal PR, reviewers should verify:
- [ ] No secrets or tokens have been committed.
- [ ] Logic changes were not introduced (the pipeline only formats, updates types, syncs deps, and builds artifacts).
- [ ] Artifact logs (`pre_healthcheck.log`, `repair.log`, `post_healthcheck.log`) confirm the intended repair behavior.

## Overriding the Schedule
To override the automatically computed schedule:
1. Manually edit `.github/self-heal-schedule.yml`.
2. Update the `schedule` string with the preferred cron expression.
3. Commit and push the changes. The pipeline will respect this override and re-evaluate in subsequent compute runs if unchanged for an extended period.
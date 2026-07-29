# Self-Healing CI Pipeline Setup

This repository is equipped with an automated self-healing CI pipeline that detects code drift, formatting issues, and test failures, and automatically proposes fixes via Pull Requests.

## Triggers
The self-healing pipeline runs under three conditions:
1. **Scheduled:** Proactively runs based on a self-computed schedule (to catch drift).
2. **CI Failure:** Reactively runs when the main `ci` workflow fails.
3. **Manual Dispatch:** Can be manually triggered via the GitHub Actions tab.

## Self-Scheduling Logic
The pipeline dynamically computes its own optimal run frequency based on repository telemetry (commit frequency, pull request velocity).
- Active repositories will be checked more frequently.
- Dormant repositories will be checked less frequently to save CI minutes.
- The schedule is recomputed weekly via the `Compute Self-Heal Schedule` workflow, which creates a PR if the schedule needs to change.

## Repair Pipeline Steps
The pipeline is idempotent and executes the following steps:
1. **Rebuild/Reinstall:** Clean install of tooling and dependencies.
2. **Lint/Format:** Auto-fix linting and formatting issues (via `eslint` and `prettier`).
3. **Snapshot Updates:** Updates missing or outdated test snapshots (via `vitest -u`).
4. **Type Stubs:** Acquires missing type definitions.
5. **Dependency Re-resolve:** Refreshes the package lockfile.
6. **Static Assets:** Regenerates documentation or code-gen assets (if applicable).

After each step, a healthcheck is executed. If the healthcheck passes and there is a diff, the pipeline stops and creates a PR immediately to provide the minimal fix.

## Customization and Overrides
To override the schedule:
1. Manually edit `.github/self-heal-schedule.yml`.
2. Ensure you keep the `# AUTO-UPDATED` comment at the bottom.
3. Commit and push the changes. The pipeline will respect this change, although it will eventually be re-evaluated.

## Reviewer Checklist
When reviewing a `[Self-Heal]` PR, ensure:
- [ ] No unwanted dependency changes were introduced.
- [ ] Formatting changes align with project standards.
- [ ] Any updated test snapshots are logically correct and not masking a true bug.
- [ ] There are no exposed secrets or tokens in the diff.

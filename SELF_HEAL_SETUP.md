# Self-Healing CI Pipeline Setup

This repository has been configured with an automated self-healing CI pipeline designed to address code drift, keep dependencies updated, format code, and sync types automatically.

## Triggers

The automation runs based on three distinct triggers:
1. **Scheduled:** Runs on an adaptive computed cadence based on telemetry.
2. **Reactive:** Triggers automatically when the `ci` workflow fails.
3. **Manual:** Can be triggered manually via the GitHub Actions `workflow_dispatch` UI.

## The 6 Repair Steps

When triggered, the pipeline performs the following idempotent steps:
1. **Clean Install:** Runs `npm ci` to ensure tooling and dependencies are correctly installed.
2. **Format & Lint:** Runs `eslint --fix` and `prettier -w` to resolve formatting and linting errors.
3. **Test Snapshots:** Runs `vitest run -u` to regenerate test snapshots if they've drifted.
4. **Sync Types:** Uses `typesync` to acquire missing type stubs and updates `package.json`.
5. **Update Dependencies:** Runs `npm update` to resolve minor or patch dependency updates safely.
6. **Regenerate Assets:** Placeholder for any potential generic asset regeneration if applicable to this project.

After each step, the script checks the project's health. It will exit immediately if the state is healthy and there is a git diff, ensuring only necessary and safe changes are committed.

## Self-Scheduling Logic

The `compute-schedule.yml` workflow runs periodically to analyze the repository's PR velocity telemetry. Based on this telemetry, it computes the most optimal schedule.

If the schedule changes, the workflow will create a PR to modify `.github/workflows/self-heal.yml` and `.github/self-heal-schedule.yml`.

### Manual Overrides
To manually override the schedule:
1. Modify `.github/self-heal-schedule.yml` with your desired `SCHEDULE` and `RATIONALE`.
2. Update the timestamp in `LAST_UPDATED` (in ms since epoch).
3. The automation will respect your change until it computes a significant velocity shift or the oscillation guard expires.

## Reviewer Checklist

When reviewing a `selfheal-*` PR, please verify:
- [ ] No secrets or keys have been inadvertently committed.
- [ ] The `pre-check.log`, `repair.log`, and `post-check.log` artifacts provide clear explanations for the automated changes.
- [ ] Logic files (source code, tests aside from snapshots) have not been negatively impacted by the formatting/linting changes.
- [ ] Dependency updates appear intentional and safe.

The automation runs as `github-actions[bot]`, and any proposed changes must always undergo human review.

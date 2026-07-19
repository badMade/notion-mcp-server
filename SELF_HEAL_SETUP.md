# Self-Healing Pipeline Setup

This repository is equipped with an automated self-healing CI pipeline.

## Overview

The self-healing pipeline attempts to automatically repair code drift, linting errors, missing types, and dependency locks that cause CI failures or degrade the codebase over time.

### Triggers
- **Reactive (`ci_failure`)**: Triggers when the main `ci` workflow fails.
- **Proactive (`scheduled`)**: Triggers based on an auto-computed schedule tailored to the repository's activity.
- **Manual (`manual_dispatch`)**: Can be manually run via the GitHub Actions UI.

## How it works

When triggered, the pipeline runs `.github/workflows/self-heal.yml`. The core repair process (`scripts/self_heal.mjs`) is completely idempotent and tries the following steps, running a `healthcheck.mjs` after each:
1. **Rebuild/reinstall**: Cleans the environment and re-installs dependencies.
2. **Lint/format auto-fix**: Runs `eslint --fix` or equivalent formatters.
3. **Snapshot updates**: Updates Vitest/Jest test snapshots that might have drifted.
4. **Type stubs**: Configures missing stubs.
5. **Dependency re-resolve**: Updates lockfiles.
6. **Asset regeneration**: Builds docs, badges, or other generated code.

If any step fixes the build and produces a diff, a Pull Request is opened for a human to review.

## Auto-Scheduling Mechanism

The schedule (`.github/self-heal-schedule.yml`) is NOT hardcoded. A secondary workflow (`.github/workflows/compute-schedule.yml`) runs periodically to compute the optimal schedule based on recent PR merge and commit telemetry.

- **High Activity**: Runs more frequently (e.g. every 12 hours)
- **Low Activity**: Runs less frequently (e.g. weekly)

The computed schedule is automatically applied to `.github/workflows/self-heal.yml` via an auto-generated PR.

## Overriding the Schedule

If you want to manually override the schedule:
1. Edit `.github/self-heal-schedule.yml` with your preferred cron syntax.
2. Ensure you modify the `last_updated` date to be current to avoid it being immediately overridden by the oscillation guard.
3. Edit `.github/workflows/self-heal.yml` to reflect your chosen schedule in the `# AUTO-UPDATED` marker line.

## Reviewer Checklist

When reviewing a PR from `github-actions[bot]` with the `self-heal` label:
- [ ] Check if the changes are legitimate fixes (e.g. updated snapshots from expected component changes).
- [ ] Check the uploaded workflow logs to see which step produced the fix.
- [ ] Verify no unapproved new dependencies were added.
- [ ] Merge the PR to keep the main branch green.

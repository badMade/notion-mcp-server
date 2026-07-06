# Self-Healing Pipeline Setup

This repository is equipped with an automated self-healing pipeline designed to detect code drift (e.g., missing lockfile updates, incorrect formatting, missing type stubs, failed snapshots) and automatically submit Pull Requests to fix them.

## Triggers

1. **Scheduled:** Runs based on an adaptive schedule that computes optimal execution times based on project PR velocity.
2. **Reactive:** Runs immediately if the main CI workflow fails on the `main` branch.
3. **Manual:** Can be manually dispatched from the GitHub Actions tab.

## Adaptive Scheduling

The scheduling is fully adaptive and driven by the `scripts/compute_schedule.mjs` script, which evaluates:

- Recent PR velocity (high, active, standard, low-churn, dormant)
- CI failure rates

It will automatically adjust the `cron` expression in `.github/workflows/self-heal.yml` to run more frequently when the repository is active, and less frequently when it is dormant.

### How to Override the Schedule

If you want to pin a specific schedule and stop the adaptive automation:

1. Edit `.github/workflows/self-heal.yml`.
2. Remove or change the `# AUTO-UPDATED` comment next to the `cron:` string.
3. Or, disable the `compute-schedule.yml` workflow entirely via GitHub settings.

## Idempotent Repair Steps

The pipeline sequentially runs through a series of safe, idempotent repair steps defined in `scripts/self_heal.mjs`:

1. Rebuild/Reinstall dependencies.
2. Lint/Format Auto-fix.
3. Snapshot Regeneration.
4. Type Stubs and Analyzer Config generation (`typesync`).
5. Dependency Re-resolve (`npm update`).
6. Static Asset Regeneration.

After every step, the `scripts/healthcheck.mjs` script runs to see if the changes resulted in a passing baseline. If so, a PR is immediately opened.

## Reviewer Checklist

Whenever a self-heal PR is opened, reviewers should ensure:

- [ ] No unintended dependencies were bumped outside of patch/minor ranges.
- [ ] Linting/formatting changes align with team standards.
- [ ] Test snapshots genuinely represent the intended new state, rather than masking a bug.
- [ ] No sensitive information (API keys, secrets) was inadvertently generated or staged. (The pipeline has built-in entropy scanning to help prevent this).

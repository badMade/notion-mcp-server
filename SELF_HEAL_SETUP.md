# Self-Healing Automation Setup

## Overview

This repository has an automated self-healing CI pipeline configured via GitHub Actions.
It consists of reactive and proactive self-repair processes intended to fix codebase drift, such as lint errors, out-of-date snapshots, or broken dependencies before they degrade system health.

The core of the logic is handled by:
1. `scripts/healthcheck.mjs` - A strict verifier for build, lint, and core tests.
2. `scripts/self_heal.mjs` - An idempotent, multi-stage repair pipeline encompassing install, autofix, snapshot updates, types, and dependencies.
3. `.github/workflows/self-heal.yml` - The main GitHub Action workflow which kicks off repairs and issues PRs.

### Triggers:
- **Scheduled:** Periodically runs using an auto-computed schedule (to catch environmental rot/drift).
- **CI Failure:** Automatically dispatched when the main `ci` workflow fails.
- **Manual:** Can be dispatched via `workflow_dispatch`.

## Schedule Logic

The `scripts/compute_schedule.mjs` script determines the best execution cadence by evaluating Git commit metrics.
It automatically adjusts the schedule tier (e.g., dormant, low churn, standard, active, high velocity) and writes the state to `.github/self-heal-schedule.yml`.

A separate workflow (`.github/workflows/compute-schedule.yml`) continuously re-evaluates the schedule against real telemetry, scaling operations back or up seamlessly by generating self-updating PRs.

## PR Creation

The self-heal workflows follow strict safety rules:
- They *never* commit directly to `main` (only PRs are opened).
- PRs contain the label `self-heal` or `self-heal-schedule`.
- A regex-based entropy scan ensures no stray secrets/keys are accidentally committed.
- Any open duplicate self-heal PRs will prevent the creation of new redundant ones.
- Artifact logs (`pre-check.log` and `repair.log`) are attached to the workflow to explain the action.

## Reviewer Checklist

When reviewing a PR from `github-actions[bot]`:
- [ ] Check the changed files and ensure the modifications strictly fix syntax, snapshot, formatting, or lockfile drift.
- [ ] Ensure that no logical or complex codebase regressions were introduced by the repair pipeline.
- [ ] Verify that CI on the PR passes successfully.
- [ ] For `[Self-Heal Schedule]` PRs, confirm the schedule makes sense regarding recent repository activity.

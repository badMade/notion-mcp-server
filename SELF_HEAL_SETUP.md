# Self-Healing Pipeline Setup

This project utilizes an automated self-healing CI pipeline to detect drift, auto-repair common issues, and submit changes for human review via Pull Requests.

## Overview

The automation relies on 3 main triggers:
1. **Scheduled (Proactive)**: Computed based on repository velocity telemetry to prevent bit-rot and keep dependencies/snapshots up to date.
2. **CI Failure (Reactive)**: Triggered whenever the main `ci` workflow fails.
3. **Manual Dispatch**: Available on-demand via the GitHub Actions UI.

## How It Works

The repair pipeline consists of scripts located in `scripts/`:
- `healthcheck.mjs`: Acts as a gate, ensuring tests, linting, and builds pass.
- `self_heal.mjs`: Runs 6 idempotent repair steps:
  1. **Rebuild/reinstall**: `npm ci || npm install`
  2. **Lint/format auto-fix**: `npx eslint --fix . && npx prettier -w .`
  3. **Snapshot updates**: `npx vitest run -u --passWithNoTests`
  4. **Type config/analyzer**: `npx tsc --build`
  5. **Dependency re-resolve**: `npm update`
  6. **Static asset generation**: `npm run build`
- `compute_schedule.mjs`: Analyzes commit velocity to compute an optimal schedule cadence and avoid thrashing.

### Safety Guards

- PR duplication is prevented.
- A branch guard prevents automated loops from triggering themselves.
- A simple heuristic secret scanner checks for introduced tokens before creating a PR.
- Changes must pass the `healthcheck.mjs` before being submitted.

## Reviewer Checklist

When reviewing a PR prefixed with `[Self-Heal ...]`, please check:
- [ ] Ensure the changes only affect formatting, lockfiles, snapshots, or dependencies.
- [ ] Ensure there are no logic changes or inadvertently removed code.
- [ ] Review the artifact logs (`pre-check.log`, `repair.log`, `post-check.log`) attached to the PR.
- [ ] Validate no secrets or sensitive data were pushed.

## Manual Schedule Override

If you wish to override the telemetry-based schedule:
1. Edit `.github/self-heal-schedule.yml` directly.
2. Change the `schedule` to the desired cron value.
3. Optionally disable `.github/workflows/compute-schedule.yml` to prevent it from reverting your override.

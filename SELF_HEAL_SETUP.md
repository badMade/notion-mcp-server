# Self-Heal Auto-Repair Configuration

This repository includes a fully autonomous **self-healing auto-repair** pipeline designed to correct minor code drift, format deviations, stale lockfiles, and missing type definitions.

## How it works

The automation is powered by two distinct GitHub Actions workflows and three internal scripts:

### Workflows
1. **`self-heal.yml`**: Runs the actual repair jobs. It can be triggered three ways:
   - **Scheduled:** Runs on a computed schedule to proactively detect and fix drift.
   - **Reactive (CI failure):** Runs automatically when the primary `ci` workflow fails.
   - **Manual:** Can be invoked via GitHub's "Workflow Dispatch".
2. **`compute-schedule.yml`**: Periodically (weekly) reviews repository activity via git and gh cli telemetry to recompute the most optimal time and frequency to run proactive repairs.

### Core Scripts
1. **`scripts/healthcheck.mjs`**: A rigorous gatekeeper. Ensures that only repairs which successfully complete build, lint, types, and test steps can be proposed. Also strictly enforces boundaries to prevent accidental modification of source logic or secrets.
2. **`scripts/self_heal.mjs`**: Executes 6 idempotent repair steps sequentially:
   - 1. Dependency re-install (`npm ci`)
   - 2. Auto-linting and formatting (`eslint --fix` & `prettier -w`)
   - 3. Updating snapshots (`vitest -u`)
   - 4. Fetching missing type definitions (`typesync`)
   - 5. Updating dependencies (`npm update`)
   - 6. Regenerating static assets (`npm run build`)
3. **`scripts/compute_schedule.mjs`**: Calculates repository PR velocity and active hours to set optimal proactive schedules. Contains an oscillation guard to prevent thrashing.

## Overriding the Schedule
The current schedule is stored in `.github/self-heal-schedule.yml`.

If you wish to force a manual schedule:
1. Edit `.github/self-heal-schedule.yml` directly.
2. Change the `schedule` string (ensuring you keep `# AUTO-UPDATED`).
3. Update `last_updated` to the current date/time to trigger the oscillation guard so the compute job won't immediately overwrite it.

## Reviewer Checklist
Whenever the bot creates a PR:
- Check that the proposed modifications are restricted to formats, snapshots, imports, lockfiles, or configurations.
- Ensure no source logic files have been altered.
- Check that no sensitive credentials or API keys have been introduced.
- Confirm the PR title reflects the trigger source (Scheduled vs. Reactive).

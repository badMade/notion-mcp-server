#!/usr/bin/env node

/**
 * compute_schedule.mjs
 *
 * Computes an optimal cron schedule for self-healing runs based on PR velocity
 * and commit activity. Uses js-yaml for safe round-trip editing.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

const SCHEDULE_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return '';
  }
}

function getCommitFrequency() {
  // Try to get PR velocity via gh CLI if available
  const prs = runCmd('gh pr list --state merged --json mergedAt --limit 100 2>/dev/null');
  if (prs) {
      try {
          const prData = JSON.parse(prs);
          return prData.length;
      } catch (e) {
          // ignore
      }
  }

  // Fallback to git commits in last 30 days
  const commits = runCmd('git log --since="30 days ago" --oneline');
  return commits ? commits.split('\\n').length : 0;
}

function computeCronSchedule(commitCount) {
  let schedule = '0 0 * * *'; // default: daily at midnight UTC
  let rationale = 'Default schedule';

  if (commitCount > 50) {
    schedule = '0 */6 * * *'; // high: every 6 hours
    rationale = 'High PR velocity detected (>50 commits/PRs recently)';
  } else if (commitCount > 20) {
    schedule = '0 */12 * * *'; // active: every 12 hours
    rationale = 'Active PR velocity detected (20-50 commits/PRs recently)';
  } else if (commitCount > 5) {
    schedule = '0 0 * * *'; // standard: daily
    rationale = 'Standard PR velocity detected (5-20 commits/PRs recently)';
  } else {
    schedule = '0 0 * * 1'; // low/dormant: weekly on Monday
    rationale = 'Low churn/dormant repository (<5 commits/PRs recently)';
  }

  return { schedule, rationale };
}

console.log('Computing new schedule...');
const commitCount = getCommitFrequency();
console.log(`Detected PR/Commit count: ${commitCount}`);

const { schedule, rationale } = computeCronSchedule(commitCount);
console.log(`Computed schedule: "${schedule}" (${rationale})`);

// Read existing schedule file to check if changes are needed
let currentSchedule = '';
try {
    if (fs.existsSync(SCHEDULE_FILE)) {
        const doc = yaml.load(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
        if (doc && doc.schedule) {
            currentSchedule = doc.schedule;
        }
    }
} catch (e) {
    console.error(`Error reading ${SCHEDULE_FILE}: ${e.message}`);
}

if (schedule === currentSchedule) {
    console.log('Schedule is unchanged. Exiting.');
    process.exit(0);
}

// Update schedule file
try {
    const newDoc = {
        schedule: schedule,
        rationale: rationale,
        last_updated: new Date().toISOString()
    };
    fs.writeFileSync(SCHEDULE_FILE, yaml.dump(newDoc));
    console.log(`Updated ${SCHEDULE_FILE}`);
} catch (e) {
    console.error(`Failed to write ${SCHEDULE_FILE}: ${e.message}`);
    process.exit(1);
}

// Safely update workflow file using simple replacement if js-yaml doesn't preserve comments well enough
// or using sed fallback logic as requested by instructions
try {
    if (fs.existsSync(WORKFLOW_FILE)) {
        let workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
        // Replace the line with # AUTO-UPDATED marker
        const regex = /^\s*- cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED.*$/m;
        if (regex.test(workflowContent)) {
            workflowContent = workflowContent.replace(regex, `    - cron: '${schedule}' # AUTO-UPDATED`);
            fs.writeFileSync(WORKFLOW_FILE, workflowContent);
            console.log(`Updated ${WORKFLOW_FILE}`);
        } else {
            console.log(`Could not find # AUTO-UPDATED marker in ${WORKFLOW_FILE}. Trying sed fallback.`);
            runCmd(`sed -i "s|.*# AUTO-UPDATED.*|    - cron: '${schedule}' # AUTO-UPDATED|g" ${WORKFLOW_FILE}`);
        }
    }
} catch (e) {
    console.error(`Error updating workflow file: ${e.message}`);
    process.exit(1);
}

console.log('Schedule computation complete.');
process.exit(0);

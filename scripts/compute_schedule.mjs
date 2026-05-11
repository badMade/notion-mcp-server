#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const workflowsDir = path.join(projectRoot, '.github', 'workflows');
const selfHealWorkflowPath = path.join(workflowsDir, 'self-heal.yml');
const scheduleMetadataPath = path.join(projectRoot, '.github', 'self-heal-schedule.yml');

function getTelemetry() {
  try {
    // Attempt to get PR merge frequency (last 30 PRs)
    const prsJson = execSync('gh pr list --state merged --json mergedAt --limit 30', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const prs = JSON.parse(prsJson);

    // Attempt to get commit frequency by hour
    const commitsStr = execSync('git log --format=%aI -n 100', { encoding: 'utf-8' });
    const commits = commitsStr.trim().split('\n').filter(Boolean);

    return { prs, commits };
  } catch (err) {
    console.warn("Could not fetch telemetry (e.g., gh CLI not authenticated or no git history). Using fallback defaults.");
    return { prs: [], commits: [] };
  }
}

function computeSchedule(telemetry) {
  const { prs, commits } = telemetry;
  let cronExpr = '0 3 * * *'; // Default to 3 AM UTC daily
  let rationale = 'Default infrequent schedule due to lack of telemetry.';

  if (commits.length > 50) {
     rationale = 'Active repository detected (>50 recent commits). Setting weekly repair at a quiet time.';
     cronExpr = '0 4 * * 0'; // Sunday 4 AM
  }

  if (prs.length > 10) {
    const dates = prs.map(pr => new Date(pr.mergedAt));
    const now = new Date();
    const recentPRs = dates.filter(d => (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000); // PRs in last 7 days

    if (recentPRs.length > 5) {
      rationale = `High velocity detected (${recentPRs.length} PRs in last 7 days). Setting daily repair.`;
      cronExpr = '0 2 * * *'; // 2 AM Daily
    }
  }

  return { cronExpr, rationale };
}

function updateScheduleMetadata(cronExpr, rationale) {
  const metadata = {
    schedule: cronExpr,
    rationale,
    last_updated: new Date().toISOString()
  };
  fs.writeFileSync(scheduleMetadataPath, yaml.dump(metadata), 'utf-8');
  console.log(`Updated ${scheduleMetadataPath}`);
}

function updateWorkflowFile(cronExpr) {
  if (!fs.existsSync(selfHealWorkflowPath)) {
    console.log(`Workflow file ${selfHealWorkflowPath} not found yet. Cannot update schedule inline.`);
    return;
  }

  let content = fs.readFileSync(selfHealWorkflowPath, 'utf-8');
  const lines = content.split('\n');
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('# AUTO-UPDATED')) {
      const parts = lines[i].split('-');
      if (parts.length > 1 && parts[0].trim() === '') {
         // Found cron array element: "    - cron: '...'"
         const whitespace = lines[i].match(/^\s*/)[0];
         lines[i] = `${whitespace}- cron: '${cronExpr}' # AUTO-UPDATED`;
         updated = true;
         break;
      }
    }
  }

  if (updated) {
     const newContent = lines.join('\n');
     try {
       yaml.load(newContent); // validate it's still parseable
       fs.writeFileSync(selfHealWorkflowPath, newContent, 'utf-8');
       console.log(`Updated ${selfHealWorkflowPath}`);
     } catch (err) {
       console.error("YAML validation failed after mutator update! Reverting.");
     }
  } else {
     console.log("Could not find '# AUTO-UPDATED' marker in workflow file to update.");
  }
}

const telemetry = getTelemetry();
const { cronExpr, rationale } = computeSchedule(telemetry);

console.log(`Computed Schedule: ${cronExpr}`);
console.log(`Rationale: ${rationale}`);

updateScheduleMetadata(cronExpr, rationale);
updateWorkflowFile(cronExpr);

console.log("Compute schedule finished.");

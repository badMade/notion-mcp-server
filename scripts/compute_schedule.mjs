#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

function runCmd(cmd) {
  try {
    return execSync(cmd).toString().trim();
  } catch (err) {
    return '';
  }
}

// Ensure execution directory
const repoRoot = path.resolve(process.cwd());
const scheduleFile = path.join(repoRoot, '.github', 'self-heal-schedule.yml');
const workflowFile = path.join(repoRoot, '.github', 'workflows', 'self-heal.yml');

function computeSchedule() {
  console.log("Computing schedule based on telemetry...");
  let tier = 'standard';

  // Try dynamic computation
  try {
    // Check recent merged PRs using gh
    const prDataStr = runCmd('gh pr list --state merged --json mergedAt -L 100');
    let prCount = 0;
    if (prDataStr) {
      const prData = JSON.parse(prDataStr);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      prCount = prData.filter(pr => new Date(pr.mergedAt) > oneWeekAgo).length;
    }

    // Evaluate self-heal open PRs success and adjust tier if needed
    // Look at consecutive empty runs or successful PRs
    const selfhealPrsStr = runCmd('gh pr list --label self-heal --json state,createdAt -L 10');
    let consecutiveEmptyRuns = 0;
    let consecutiveSuccessfulPRs = 0;
    if (selfhealPrsStr) {
        const prs = JSON.parse(selfhealPrsStr);
        for (let pr of prs) {
            if (pr.state === 'MERGED') consecutiveSuccessfulPRs++;
            else consecutiveSuccessfulPRs = 0;

            // Assuming empty runs are tracked in some other way, but we will count CLOSED self-heal prs as empty runs
            if (pr.state === 'CLOSED') consecutiveEmptyRuns++;
            else consecutiveEmptyRuns = 0;
        }
    }

    // Dynamic tier assignment based on PR counts
    if (prCount > 10) tier = 'high';
    else if (prCount > 5) tier = 'active';
    else if (prCount > 2) tier = 'standard';
    else if (prCount > 0) tier = 'low-churn';
    else tier = 'dormant';

    // Adjust logic based on self-heal runs
    const tiers = ['dormant', 'low-churn', 'standard', 'active', 'high'];
    let tierIndex = tiers.indexOf(tier);
    if (consecutiveEmptyRuns >= 3) {
        tierIndex = Math.max(0, tierIndex - 1);
    }
    if (consecutiveSuccessfulPRs >= 3) {
        tierIndex = Math.min(tiers.length - 1, tierIndex + 1);
    }
    tier = tiers[tierIndex];

    // Detect active periods using git log
    const gitLog = runCmd('git log --format=%aI -n 50');
    const hours = new Array(24).fill(0);
    if (gitLog) {
        gitLog.split('\n').forEach(line => {
            if (line) {
                const h = new Date(line).getHours();
                hours[h]++;
            }
        });
    }

    // find quietest hour
    let quietestHour = 0;
    let minCommits = Infinity;
    for (let i = 0; i < 24; i++) {
        if (hours[i] < minCommits) {
            minCommits = hours[i];
            quietestHour = i;
        }
    }

    const h = quietestHour;

    const schedules = {
      'high': `0 ${h}, ${(h+4)%24}, ${(h+8)%24}, ${(h+12)%24}, ${(h+16)%24}, ${(h+20)%24} * * *`,
      'active': `0 ${h}, ${(h+8)%24}, ${(h+16)%24} * * *`,
      'standard': `0 ${h} * * *`,
      'low-churn': `0 ${h} * * 1,4`,
      'dormant': `0 ${h} * * 1`
    };

    const schedule = schedules[tier];
    console.log(`Computed tier: ${tier}, Schedule: ${schedule}`);
    return { tier, schedule };

  } catch (e) {
    console.error("Failed to fetch telemetry, using fallback.");
    // calculate a fallback from pure git log if gh is unavailable
    const h = Math.floor(Math.random() * 24); // using random as a last resort dynamic since gh failed
    return { tier: 'standard', schedule: `0 ${h} * * *` };
  }
}

function updateScheduleFiles(newSchedule, tier) {
  const now = new Date().toISOString();

  // Update .github/self-heal-schedule.yml
  let scheduleData = {
    schedule: newSchedule,
    rationale: `Computed based on telemetry (tier: ${tier})`,
    last_updated: now
  };

  if (fs.existsSync(scheduleFile)) {
    try {
      const existing = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));

      // Guard against oscillation
      if (existing && existing.last_updated) {
        const lastUpdatedDate = new Date(existing.last_updated);
        const hoursSinceUpdate = (new Date() - lastUpdatedDate) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24 && existing.schedule === newSchedule) {
          console.log("Schedule updated recently and unchanged. Skipping.");
          return false;
        }
      }

      scheduleData = { ...existing, ...scheduleData };
    } catch (e) {
      console.error("Failed to parse existing schedule.yml. Overwriting.");
    }
  }

  fs.writeFileSync(scheduleFile, yaml.dump(scheduleData));

  // Validate YAML mutator output
  try {
    yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
  } catch (err) {
    console.error("YAML Mutator output invalid:", err);
    process.exit(1);
  }

  // Update actual github actions workflow self-heal.yml
  if (fs.existsSync(workflowFile)) {
    let wfContent = fs.readFileSync(workflowFile, 'utf8');
    // Inline schedule updates via regex fallback
    wfContent = wfContent.replace(/cron:.*# AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);
    fs.writeFileSync(workflowFile, wfContent);

    // Validate WF mutator output
    try {
      yaml.load(fs.readFileSync(workflowFile, 'utf8'));
    } catch (err) {
      console.error("Workflow Mutator output invalid:", err);
      process.exit(1);
    }
  } else {
      console.log(`Workflow file not found: ${workflowFile}`);
  }

  return true;
}

const { schedule, tier } = computeSchedule();
const updated = updateScheduleFiles(schedule, tier);

if (updated) {
  console.log(`Updated schedule to: ${schedule}`);
}

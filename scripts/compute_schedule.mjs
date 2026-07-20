#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting Telemetry and Schedule Computation...');

// Ensure js-yaml is available
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (e) {
  console.error('js-yaml is required for safe round-trip editing. Attempting to require...');
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    yaml = require('js-yaml');
  } catch (e2) {
    console.error('Could not load js-yaml. Please install it with: npm install -D js-yaml@4');
    process.exit(1);
  }
}

const SCHEDULE_META_PATH = '.github/self-heal-schedule.yml';
const WORKFLOW_PATH = '.github/workflows/self-heal.yml';

// Guard against oscillation
if (fs.existsSync(SCHEDULE_META_PATH)) {
  const content = fs.readFileSync(SCHEDULE_META_PATH, 'utf8');
  try {
    const meta = yaml.load(content);
    if (meta && meta.last_updated) {
      const lastUpdate = new Date(meta.last_updated);
      const now = new Date();
      const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
      if (diffHours < 24) {
        console.log(`ℹ️ Schedule was updated recently (${diffHours.toFixed(1)} hours ago). Skipping computation to prevent oscillation.`);
        process.exit(0);
      }
    }
  } catch (e) {
    console.warn('Failed to parse existing schedule metadata. Proceeding with computation.');
  }
}

// 1. Telemetry Gathering
let prCount = 0;
let commitCount = 0;
try {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
  const commitOutput = execSync(`git log --since="${since}" --format=%aI`).toString().trim();
  commitCount = commitOutput ? commitOutput.split('\n').length : 0;

  // We could use `gh` CLI here but it might not be available or authed locally.
  try {
    const prOutput = execSync(`gh pr list --state merged --json mergedAt -L 100`).toString();
    const prs = JSON.parse(prOutput);
    prCount = prs.filter(pr => new Date(pr.mergedAt) >= new Date(since)).length;
  } catch (e) {
    console.warn('gh cli not available or failed. Using commit count for proxy.');
    prCount = Math.floor(commitCount / 3);
  }
} catch (e) {
  console.warn('Telemetry gathering failed. Using default defaults.');
}

console.log(`Telemetry (Last 7 days): Commits=${commitCount}, PRs=${prCount}`);

// 2. Determine Cadence Tier
let cadence = '0 0 * * 0'; // default dormant (weekly)
let rationale = 'Dormant: Very low activity. Weekly checks.';
let tier = 'dormant';

if (prCount > 10 || commitCount > 30) {
  cadence = '0 */4 * * 1-5';
  rationale = 'High velocity: >10 PRs or >30 commits/week. Running every 4 hours on weekdays.';
  tier = 'high';
} else if (prCount > 5 || commitCount > 15) {
  cadence = '0 9,17 * * 1-5';
  rationale = 'Active velocity: >5 PRs or >15 commits/week. Running twice a day on weekdays.';
  tier = 'active';
} else if (prCount > 1 || commitCount > 5) {
  cadence = '0 3 * * *';
  rationale = 'Standard velocity. Running daily during off-hours.';
  tier = 'standard';
} else if (commitCount > 0) {
  cadence = '0 0 * * 1,4';
  rationale = 'Low churn. Running twice a week.';
  tier = 'low-churn';
}

console.log(`Computed Tier: ${tier}`);
console.log(`Computed Schedule: ${cadence}`);

// 3. Update metadata file
const newMeta = {
  current_schedule: cadence,
  tier: tier,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

fs.mkdirSync(path.dirname(SCHEDULE_META_PATH), { recursive: true });
fs.writeFileSync(SCHEDULE_META_PATH, yaml.dump(newMeta));
console.log(`✅ Updated ${SCHEDULE_META_PATH}`);

// 4. Update workflow file if it exists
if (fs.existsSync(WORKFLOW_PATH)) {
  let wfContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  // Safer inline sed-like replacement anchored by marker
  const scheduleLineRegex = /cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED/g;
  if (scheduleLineRegex.test(wfContent)) {
    wfContent = wfContent.replace(scheduleLineRegex, `cron: '${cadence}' # AUTO-UPDATED`);

    // Validate output is parseable before writing
    try {
      yaml.load(wfContent);
      fs.writeFileSync(WORKFLOW_PATH, wfContent);
      console.log(`✅ Updated ${WORKFLOW_PATH}`);
    } catch (e) {
      console.error('Generated workflow YAML is invalid. Aborting workflow update.');
      process.exit(1);
    }
  } else {
    console.warn(`Could not find "# AUTO-UPDATED" marker in ${WORKFLOW_PATH}. Skipping inline update.`);
  }
}

// 5. Diff check
try {
  const diff = execSync('git status --porcelain').toString().trim();
  if (diff) {
    console.log('✅ Schedule updated and diff generated.');
  } else {
    console.log('ℹ️ Schedule unchanged.');
  }
} catch (e) {
  console.warn('Could not check git status.');
}

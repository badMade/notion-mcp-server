import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SCHEDULE_YAML_PATH = path.join(PROJECT_ROOT, '.github', 'self-heal-schedule.yml');
const WORKFLOW_YAML_PATH = path.join(PROJECT_ROOT, '.github', 'workflows', 'self-heal.yml');

// Helper to run shell commands
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

// Compute the schedule based on recent PR/CI activity
function computeSchedule() {
  console.log('Gathering telemetry...');

  // Try to get PR history (requires gh cli and auth, might fail locally)
  const prJson = runCmd('gh pr list --state merged --json mergedAt --limit 100 2>/dev/null');
  let prCount = 0;
  if (prJson) {
    try {
      const prs = JSON.parse(prJson);
      // Count PRs in the last 7 days
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      prCount = prs.filter(pr => new Date(pr.mergedAt).getTime() > oneWeekAgo).length;
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Fallback defaults or low activity -> 1 per day (2 AM)
  let cronExpr = '0 2 * * *';
  let tier = 'low-churn';

  if (prCount > 50) {
    cronExpr = '0 */6 * * *'; // Every 6 hours
    tier = 'high';
  } else if (prCount > 20) {
    cronExpr = '0 */12 * * *'; // Every 12 hours
    tier = 'active';
  } else if (prCount > 5) {
    cronExpr = '0 2 * * *'; // Every day at 2am
    tier = 'standard';
  } else if (prCount === 0) {
    cronExpr = '0 2 * * 0'; // Once a week on Sunday
    tier = 'dormant';
  }

  return {
    schedule: cronExpr,
    rationale: `Computed tier '${tier}' based on ${prCount} PRs merged in the last 7 days.`
  };
}

// Ensure the yaml files are updated
function updateSchedules(scheduleInfo) {
  const { schedule, rationale } = scheduleInfo;

  // 1. Update self-heal-schedule.yml using safe roundtrip yaml parsing
  let scheduleData = {};
  if (fs.existsSync(SCHEDULE_YAML_PATH)) {
    try {
      scheduleData = yaml.load(fs.readFileSync(SCHEDULE_YAML_PATH, 'utf8')) || {};
    } catch (e) {
      console.warn(`Failed to parse ${SCHEDULE_YAML_PATH}, starting fresh.`);
    }
  }

  if (scheduleData.SELFHEAL_SCHEDULE === schedule && scheduleData.OVERRIDE === true) {
    console.log('Schedule override detected in self-heal-schedule.yml. Skipping update.');
    return;
  }

  // Only update if changed or not present
  if (scheduleData.SELFHEAL_SCHEDULE !== schedule || scheduleData.rationale !== rationale) {
    scheduleData.SELFHEAL_SCHEDULE = schedule;
    scheduleData.rationale = rationale;
    scheduleData.last_updated = new Date().toISOString();
    scheduleData.OVERRIDE = scheduleData.OVERRIDE || false;

    fs.writeFileSync(SCHEDULE_YAML_PATH, yaml.dump(scheduleData), 'utf8');
    console.log(`Updated ${SCHEDULE_YAML_PATH} with schedule: ${schedule}`);
  } else {
    console.log('Schedule unchanged. No update needed.');
  }

  // 2. Update self-heal.yml workflow via regex to preserve the `# AUTO-UPDATED` marker
  if (fs.existsSync(WORKFLOW_YAML_PATH)) {
    let workflowContent = fs.readFileSync(WORKFLOW_YAML_PATH, 'utf8');

    // Look for lines like: - cron: '0 2 * * *' # AUTO-UPDATED
    const cronRegex = /-\s+cron:\s+['"]?[^'"]+['"]?\s+# AUTO-UPDATED/g;

    if (cronRegex.test(workflowContent)) {
      workflowContent = workflowContent.replace(
        cronRegex,
        `- cron: '${schedule}' # AUTO-UPDATED`
      );
      fs.writeFileSync(WORKFLOW_YAML_PATH, workflowContent, 'utf8');
      console.log(`Updated ${WORKFLOW_YAML_PATH} with new cron expression.`);
    } else {
      console.log(`Warning: '# AUTO-UPDATED' marker not found in ${WORKFLOW_YAML_PATH}. Run 'npm ci' and check the script logic.`);
    }
  }
}

try {
  const scheduleInfo = computeSchedule();
  console.log(`Computed Schedule: ${scheduleInfo.schedule}`);
  console.log(`Rationale: ${scheduleInfo.rationale}`);
  updateSchedules(scheduleInfo);
} catch (error) {
  console.error("Failed to compute schedule:", error);
  process.exit(1);
}

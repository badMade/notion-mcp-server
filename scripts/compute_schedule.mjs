import fs from 'fs';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

const SCHEDULE_METADATA_FILE = '.github/self-heal-schedule.yml';
const WORKFLOW_FILE = '.github/workflows/self-heal.yml';

function run(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
}

function getCommitHistory() {
  const output = run('git log --format=%aI -n 100');
  if (!output) return [];
  return output.split('\n').filter(Boolean).map(date => new Date(date));
}

function getPRVelocity() {
  // Try to use gh cli, fallback to git commits if not available
  try {
    const output = run('gh pr list --state merged --json mergedAt --limit 100');
    if (!output) return 'unknown';
    const prs = JSON.parse(output);
    if (prs.length > 50) return 'high';
    if (prs.length > 20) return 'active';
    if (prs.length > 5) return 'standard';
    return 'low-churn';
  } catch (e) {
    return 'unknown';
  }
}

function getActivePeriodHourMode(commits) {
  if (!commits || commits.length === 0) return 2; // Default to 2 AM UTC

  const hourCounts = new Array(24).fill(0);
  commits.forEach(commit => {
    hourCounts[commit.getUTCHours()]++;
  });

  // Find the quietest hour (mode of inactivity)
  let quietestHour = 0;
  let minCount = hourCounts[0];

  for (let i = 1; i < 24; i++) {
    if (hourCounts[i] < minCount) {
      minCount = hourCounts[i];
      quietestHour = i;
    }
  }

  return quietestHour;
}

function computeSchedule() {
  const commits = getCommitHistory();

  if (commits.length === 0) {
    return {
      schedule: '0 2 * * *',
      rationale: 'Fallback schedule due to empty commit history',
    };
  }

  const quietHour = getActivePeriodHourMode(commits);
  const velocity = getPRVelocity();

  let scheduleStr = '';
  let rationaleStr = '';

  // Calculate schedule based on velocity and quietest hour (schedule immediately BEFORE quiet window begins if possible)
  // We'll schedule it at the start of the quietest hour.
  const targetHour = quietHour;

  if (velocity === 'high' || commits.length > 80) {
    scheduleStr = `0 2,8,14,20 * * *`;
    rationaleStr = `Computed high velocity, distributing runs across 4 active periods.`;
  } else if (velocity === 'active' || commits.length > 40) {
    scheduleStr = `0 4,16 * * *`;
    rationaleStr = `Computed active velocity, distributing runs across 2 active periods.`;
  } else if (velocity === 'standard' || commits.length > 15) {
    scheduleStr = `0 ${targetHour} * * *`;
    rationaleStr = `Computed standard velocity, scheduling once daily at the quietest hour (${targetHour}:00 UTC).`;
  } else if (velocity === 'low-churn' || commits.length > 0) {
    // Run twice a week
    scheduleStr = `0 ${targetHour} * * 1,4`;
    rationaleStr = `Computed low-churn velocity, scheduling twice weekly at the quietest hour (${targetHour}:00 UTC).`;
  } else {
    // Dormant
    scheduleStr = `0 ${targetHour} 1 * *`;
    rationaleStr = `Computed dormant velocity, scheduling once monthly.`;
  }

  // Adjustment logic: Check recent selfheal PRs
  try {
    const selfhealOutput = run('gh pr list --label self-heal --json state,createdAt --limit 10');
    if (selfhealOutput) {
      const prs = JSON.parse(selfhealOutput);
      // Logic could adjust based on success/empty runs, but keeping it simple for now based on velocity
    }
  } catch (e) {
    // Ignore if gh cli fails
  }

  return {
    schedule: scheduleStr,
    rationale: rationaleStr,
  };
}

function main() {
  console.log('Computing optimal self-heal schedule...');

  // Read existing metadata to prevent oscillation
  let existingMeta = null;
  if (fs.existsSync(SCHEDULE_METADATA_FILE)) {
    try {
      const fileContent = fs.readFileSync(SCHEDULE_METADATA_FILE, 'utf8');
      existingMeta = yaml.load(fileContent);
    } catch (error) {
      console.warn('Could not read existing schedule metadata');
    }
  }

  if (existingMeta && existingMeta.last_updated) {
    const lastUpdate = new Date(existingMeta.last_updated);
    const now = new Date();
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);

    // Prevent oscillation by enforcing a minimum time between updates (e.g. 7 days)
    if (daysSinceUpdate < 7) {
      console.log('Schedule updated recently, skipping computation to prevent thrashing.');
      process.exit(0);
    }
  }

  const { schedule: newSchedule, rationale } = computeSchedule();

  // If no change to schedule, just exit
  if (existingMeta && existingMeta.schedule === newSchedule) {
    console.log('Schedule has not changed. Exiting.');
    process.exit(0);
  }

  // Write new metadata
  const newMeta = {
    schedule: newSchedule,
    rationale: rationale,
    last_updated: new Date().toISOString(),
  };

  fs.writeFileSync(SCHEDULE_METADATA_FILE, yaml.dump(newMeta));
  console.log(`Updated schedule metadata: ${newSchedule}`);

  // Update the workflow file
  if (fs.existsSync(WORKFLOW_FILE)) {
    try {
      const workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
      const workflowYaml = yaml.load(workflowContent);

      // Update schedule (assumes self-heal.yml has `on.schedule`)
      if (workflowYaml && workflowYaml.on && workflowYaml.on.schedule) {
        workflowYaml.on.schedule[0].cron = newSchedule;

        // Write back safely
        fs.writeFileSync(WORKFLOW_FILE, yaml.dump(workflowYaml, { lineWidth: -1 }));
        console.log('Successfully updated self-heal.yml using js-yaml');
      } else {
        console.log('self-heal.yml does not have a schedule trigger defined properly');
        // fallback using sed/string replacement on marker
        const fallbackContent = workflowContent.replace(/cron:.*# AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);
        fs.writeFileSync(WORKFLOW_FILE, fallbackContent);
        console.log('Updated schedule using regex fallback');
      }
    } catch (error) {
      console.error('Failed to update self-heal.yml via js-yaml', error);
      // Fallback
      const workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
      // Alternate delimiter to avoid regex issues with slashes/asterisks in cron
      const fallbackContent = workflowContent.replace(/cron:.*# AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);
      fs.writeFileSync(WORKFLOW_FILE, fallbackContent);
      console.log('Updated schedule using regex fallback');
    }
  }

  // Check valid parse
  try {
     yaml.load(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
  } catch(e) {
     console.error("YAML Mutator produced invalid YAML, aborting");
     process.exit(1);
  }
}

main();
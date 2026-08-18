#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import yaml from 'js-yaml';

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return '';
  }
}

const TIERS = [
  '0 0 1 * *', // 0: Dormant (Monthly)
  '0 {H} * * 0', // 1: Low-churn (Weekly)
  '0 {H} * * *', // 2: Standard (Daily)
  '0 */8 * * *', // 3: Active (Every 8 hours)
  '0 */4 * * *', // 4: High (Every 4 hours)
];

function getTelemetry() {
  const lookbackDays = 30;
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  // PR velocity
  let mergedPrCount = 0;
  try {
    const prsOutput = run(`gh pr list --state merged --search "merged:>=${sinceDate.split('T')[0]}" --json mergedAt`);
    if (prsOutput) {
      const prs = JSON.parse(prsOutput);
      mergedPrCount = prs.length;
    }
  } catch (e) {}

  // Commits
  const commitLog = run(`git log --format=%aI --since="${lookbackDays} days ago"`);
  const commits = commitLog ? commitLog.split('\n').filter(c => c) : [];

  // Recent selfheal runs success/empty
  let consecutiveEmptyRuns = 0;
  let consecutiveSuccessfulRuns = 0;
  try {
    const selfhealPrsOutput = run('gh pr list --label self-heal --state all --json state,createdAt --limit 10');
    if (selfhealPrsOutput) {
      const prs = JSON.parse(selfhealPrsOutput);
      for (const pr of prs) {
          if (pr.state === 'CLOSED') {
              consecutiveEmptyRuns++;
              consecutiveSuccessfulRuns = 0;
          } else if (pr.state === 'MERGED') {
              consecutiveSuccessfulRuns++;
              consecutiveEmptyRuns = 0;
          } else {
              break;
          }
      }
    }
  } catch (e) {}

  return { mergedPrCount, commits, consecutiveEmptyRuns, consecutiveSuccessfulRuns };
}

function getQuietestHour(commits) {
  if (commits.length === 0) return 2; // fallback to 2 AM

  const hourCounts = Array(24).fill(0);
  for (const commit of commits) {
    const d = new Date(commit);
    if (!isNaN(d.getTime())) {
      hourCounts[d.getUTCHours()]++;
    }
  }

  let minCount = Infinity;
  let minHour = 2; // fallback
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] < minCount) {
      minCount = hourCounts[i];
      minHour = i;
    }
  }
  return minHour;
}

function determineTier(mergedPrCount) {
  if (mergedPrCount === 0) return 0; // Dormant
  if (mergedPrCount < 4) return 1;   // Low-churn
  if (mergedPrCount < 15) return 2;  // Standard
  if (mergedPrCount < 40) return 3;  // Active
  return 4;                          // High
}

function computeSchedule() {
  const tel = getTelemetry();
  let baseTier = determineTier(tel.mergedPrCount);

  // Adjustment triggers
  if (tel.consecutiveEmptyRuns >= 3) {
    baseTier = Math.max(0, baseTier - 1);
  } else if (tel.consecutiveSuccessfulRuns >= 3) {
    baseTier = Math.min(4, baseTier + 1);
  }

  const quietestHour = getQuietestHour(tel.commits);

  let schedule = TIERS[baseTier].replace('{H}', quietestHour);

  let rationale = `Tier: ${['Dormant', 'Low-churn', 'Standard', 'Active', 'High'][baseTier]} ` +
                  `(PRs last 30d: ${tel.mergedPrCount}). ` +
                  `Quietest hour UTC: ${quietestHour}.`;

  if (tel.consecutiveEmptyRuns >= 3) rationale += ` Tier reduced due to ${tel.consecutiveEmptyRuns} empty runs.`;
  if (tel.consecutiveSuccessfulRuns >= 3) rationale += ` Tier increased due to ${tel.consecutiveSuccessfulRuns} successful runs.`;

  return { schedule, rationale };
}

function getManualOverride(filePath) {
   if (!fs.existsSync(filePath)) return null;
   try {
       const content = fs.readFileSync(filePath, 'utf8');
       if (!content.includes('# AUTO-UPDATED')) return null; // Assume user removed marker to override entirely
       const parsed = yaml.load(content);
       if (parsed && parsed.override_schedule) {
           return parsed.override_schedule;
       }
   } catch(e) {}
   return null;
}

function updateYaml(filePath, newSchedule, rationale) {
  if (!fs.existsSync(filePath)) {
       // create
       const content = `# AUTO-UPDATED\nschedule: "${newSchedule}"\nrationale: "${rationale}"\n`;
       fs.writeFileSync(filePath, content, 'utf8');
       return true;
  }

  const manualOverride = getManualOverride(filePath);
  if (manualOverride) {
      console.log("Manual override detected, ignoring telemetry.");
      newSchedule = manualOverride;
      rationale = "Manually overridden schedule.";
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = yaml.load(content) || {};
  } catch (e) {
    return false;
  }

  if (parsed.schedule === newSchedule) return false;

  parsed.schedule = newSchedule;
  parsed.rationale = rationale;

  const newContent = yaml.dump(parsed);
  const finalContent = '# AUTO-UPDATED\n' + newContent;

  // Validate parseable
  try {
    yaml.load(finalContent);
  } catch (e) {
    console.error("Generated YAML is invalid.");
    process.exit(1);
  }

  fs.writeFileSync(filePath, finalContent, 'utf8');
  return true;
}

function updateWorkflow(workflowPath, newSchedule) {
    if (!fs.existsSync(workflowPath)) return;
    let content = fs.readFileSync(workflowPath, 'utf8');

    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes('# AUTO-UPDATED')) {
            const spaces = line.match(/^(\s*)/)[0];
            return `${spaces}- cron: '${newSchedule}' # AUTO-UPDATED`;
        }
        return line;
    });
    fs.writeFileSync(workflowPath, newLines.join('\n'), 'utf8');
}


function main() {
  const { schedule, rationale } = computeSchedule();
  console.log(`Computed Schedule: ${schedule}`);
  console.log(`Rationale: ${rationale}`);

  const repoRoot = process.cwd();
  const scheduleFile = path.join(repoRoot, '.github', 'self-heal-schedule.yml');
  const workflowFile = path.join(repoRoot, '.github', 'workflows', 'self-heal.yml');

  const changed = updateYaml(scheduleFile, schedule, rationale);
  if (changed) {
      updateWorkflow(workflowFile, schedule);
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule_changed=true\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_schedule=${schedule}\n`);
      }
      console.log('Schedule updated.');
  } else {
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule_changed=false\n`);
      }
      console.log('Schedule unchanged.');
  }
}

main();

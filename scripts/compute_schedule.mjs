#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const SCHEDULE_FILE_PATH = resolve(REPO_ROOT, '.github/self-heal-schedule.yml');
const WORKFLOW_FILE_PATH = resolve(REPO_ROOT, '.github/workflows/self-heal.yml');

function fetchPrTelemetry() {
  try {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);
    const dateLimitStr = dateLimit.toISOString().split('T')[0];

    const mergedPrsJson = execSync(`gh pr list --state merged --json mergedAt --search "merged:>=${dateLimitStr}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: REPO_ROOT
    }).toString();
    const mergedPrs = JSON.parse(mergedPrsJson);

    const selfHealSuccessJson = execSync(`gh pr list --label self-heal --state merged --json mergedAt --search "merged:>=${dateLimitStr}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: REPO_ROOT
    }).toString();
    const selfHealSuccess = JSON.parse(selfHealSuccessJson);

    const ciFailuresJson = execSync(`gh run list --workflow=ci --json conclusion --limit 100`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: REPO_ROOT
    }).toString();
    const runs = JSON.parse(ciFailuresJson);
    const failureRate = runs.length > 0 ? runs.filter(r => r.conclusion === 'failure').length / runs.length : 0;

    return {
      mergedCount: mergedPrs.length,
      selfHealSuccessRate: selfHealSuccess.length,
      failureRate
    };
  } catch (err) {
    console.warn("Could not fetch full telemetry via gh CLI. Using fallback values.");
    return null;
  }
}

function getActiveWindow() {
  try {
    const log = execSync(`git log --format=%aI --since="30 days ago"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: REPO_ROOT
    }).toString();

    const hours = new Array(24).fill(0);
    const commits = log.split('\n').filter(Boolean);
    commits.forEach(commit => {
      const date = new Date(commit);
      hours[date.getUTCHours()]++;
    });

    let minHour = 0;
    let minCommits = hours[0];
    for (let i = 1; i < 24; i++) {
      if (hours[i] < minCommits) {
        minCommits = hours[i];
        minHour = i;
      }
    }

    let scheduledHour = (minHour - 1 + 24) % 24;
    return scheduledHour;
  } catch(e) {
    return 0; // fallback midnight
  }
}

function computeSchedule(telemetry, activeHourOffset) {
  let scheduleStr = `${activeHourOffset} 0 * * *`;
  let rationale = `Default schedule (daily at ${activeHourOffset} UTC)`;

  if (!telemetry) {
    return { scheduleStr: `0 ${activeHourOffset} * * *`, rationale: `Fallback schedule due to missing telemetry` };
  }

  const { mergedCount, failureRate, selfHealSuccessRate } = telemetry;

  if (mergedCount > 20 || failureRate > 0.2) {
    scheduleStr = `0 */6 * * *`;
    rationale = `High velocity/failure rate. Running every 6 hours.`;
  } else if (mergedCount > 10) {
    scheduleStr = `0 */12 * * *`;
    rationale = `Active velocity. Running every 12 hours.`;
  } else if (mergedCount > 2) {
    scheduleStr = `0 ${activeHourOffset} * * *`;
    rationale = `Standard velocity. Running daily before quiet period at ${activeHourOffset}:00 UTC.`;
  } else {
    scheduleStr = `0 ${activeHourOffset} * * 0`;
    rationale = `Low velocity. Running weekly before quiet period at ${activeHourOffset}:00 UTC.`;
  }

  return { scheduleStr, rationale };
}

function updateScheduleFiles(scheduleStr, rationale) {
  const scheduleConfig = yaml.load(readFileSync(SCHEDULE_FILE_PATH, 'utf8')) || {};

  if (scheduleConfig.schedule === scheduleStr) {
    console.log("Schedule is unchanged. No updates needed.");
    return;
  }

  scheduleConfig.schedule = scheduleStr;
  scheduleConfig.rationale = rationale;
  scheduleConfig.last_updated = new Date().toISOString();

  const dumpedSchedule = yaml.dump(scheduleConfig, { forceQuotes: true });
  writeFileSync(SCHEDULE_FILE_PATH, `# AUTO-UPDATED\n${dumpedSchedule}`);

  let workflowYaml = readFileSync(WORKFLOW_FILE_PATH, 'utf8');

  const newCronLine = `    # AUTO-UPDATED - Do not manually modify this line; use compute_schedule logic or self-heal-schedule.yml\n    - cron: '${scheduleStr}'`;

  const regex = /# AUTO-UPDATED[^\n]*\n\s+- cron:\s+['"][^'"]+['"]/g;
  if (regex.test(workflowYaml)) {
      workflowYaml = workflowYaml.replace(regex, newCronLine);
      writeFileSync(WORKFLOW_FILE_PATH, workflowYaml);
      console.log(`Successfully updated workflow cron to '${scheduleStr}'`);
  } else {
      console.warn("Could not find the `# AUTO-UPDATED` anchor in the workflow yaml.");
  }
}

function main() {
  console.log("Computing Self-Heal Schedule...");

  const telemetry = fetchPrTelemetry();
  const activeHourOffset = getActiveWindow();
  const { scheduleStr, rationale } = computeSchedule(telemetry, activeHourOffset);

  console.log(`Computed Schedule: ${scheduleStr}`);
  console.log(`Rationale: ${rationale}`);

  updateScheduleFiles(scheduleStr, rationale);
}

main();

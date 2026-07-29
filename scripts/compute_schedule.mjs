#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const runCommand = (command) => {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn(`Command failed: ${command}`, error.message);
    return null;
  }
};

const getCommitVelocity = () => {
  const log = runCommand('git log --format=%aI');
  if (!log) return 0;

  const dates = log.split('\\n').filter(Boolean);
  const commitCount = dates.length;
  if (commitCount === 0) return 0;
  if (commitCount === 1) return 1;

  const oldestDate = new Date(dates[dates.length - 1]);
  const newestDate = new Date(dates[0]);

  const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 3600 * 24));
  return commitCount / daysDiff;
};

const getPrMergeVelocity = () => {
  const result = runCommand('gh pr list --state merged --json mergedAt -L 100');
  if (!result) return 0;

  try {
    const prs = JSON.parse(result);
    if (prs.length === 0) return 0;

    const dates = prs.map(pr => new Date(pr.mergedAt)).sort((a, b) => a - b);
    const oldestDate = dates[0];
    const newestDate = dates[dates.length - 1];

    const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 3600 * 24));
    return prs.length / daysDiff;
  } catch (e) {
    return 0;
  }
};

const getCiFailureRate = () => {
  const result = runCommand('gh run list --workflow=ci --json conclusion -L 50');
  if (!result) return 0.5; // Assume moderate failure rate if unknown

  try {
    const runs = JSON.parse(result);
    if (runs.length === 0) return 0;

    const failures = runs.filter(run => run.conclusion === 'failure').length;
    return failures / runs.length;
  } catch (e) {
    return 0.5;
  }
};

const computeScore = () => {
  const commitVelocity = getCommitVelocity();
  const prVelocity = getPrMergeVelocity();
  const ciFailureRate = getCiFailureRate();

  // A simple heuristic combining commits per day, PR merges per day, and CI stability.
  const activityScore = (commitVelocity * 0.5) + (prVelocity * 2.0);

  // If CI fails frequently, we might want more frequent self-healing
  const failureMultiplier = 1 + ciFailureRate;

  return activityScore * failureMultiplier;
};

const getScheduleFromScore = (score) => {
  if (score > 10) return '0 * * * *'; // high velocity
  if (score > 3) return '0 */4 * * *'; // active
  if (score > 0.5) return '0 0 * * *'; // standard
  if (score > 0) return '0 0 1,15 * *'; // low churn
  return '0 0 1 * *'; // dormant
};

const computeSchedule = () => {
  const score = computeScore();
  const schedule = getScheduleFromScore(score);

  console.log(`Computed score: ${score.toFixed(2)}, schedule: ${schedule}`);
  return { schedule, score };
};

const updateScheduleConfig = (newSchedule, score) => {
  const configPath = path.resolve('.github', 'self-heal-schedule.yml');
  let currentConfig = { schedule: '0 0 * * *', reason: 'Default bootstrap', last_updated: new Date().toISOString() };

  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    try {
      currentConfig = yaml.load(fileContent) || currentConfig;
    } catch (e) {
      console.warn("Could not parse existing schedule config, replacing it.");
    }
  }

  if (currentConfig.schedule === newSchedule) {
    console.log("Schedule is unchanged.");
    return false;
  }

  currentConfig.schedule = newSchedule;
  currentConfig.reason = `Computed based on telemetry score: ${score.toFixed(2)}`;
  currentConfig.last_updated = new Date().toISOString();

  fs.writeFileSync(configPath, yaml.dump(currentConfig), 'utf8');
  console.log(`Updated ${configPath}`);
  return true;
};

const updateWorkflowCron = (newSchedule) => {
  const workflowPath = path.resolve('.github', 'workflows', 'self-heal.yml');
  if (!fs.existsSync(workflowPath)) {
    console.warn("Workflow file not found, skipping inline update.");
    return;
  }

  let content = fs.readFileSync(workflowPath, 'utf8');
  const cronRegex = /cron:\s*["'][^"']+["']\s*# AUTO-UPDATED/;

  if (!cronRegex.test(content)) {
    console.warn("Could not find '# AUTO-UPDATED' marker in workflow file.");
    return;
  }

  content = content.replace(cronRegex, `cron: "${newSchedule}" # AUTO-UPDATED`);

  // Validate it's still valid YAML
  try {
    yaml.load(content);
    fs.writeFileSync(workflowPath, content, 'utf8');
    console.log(`Updated cron in ${workflowPath}`);
  } catch (error) {
    console.error("Updating workflow cron resulted in invalid YAML. Aborting inline update.");
    process.exit(1);
  }
};

const main = () => {
  const { schedule, score } = computeSchedule();
  const changed = updateScheduleConfig(schedule, score);
  if (changed) {
    updateWorkflowCron(schedule);
  }
};

main();

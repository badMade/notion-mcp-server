#!/usr/bin/env node

/**
 * Computes an optimal cron schedule for self-healing runs based on project telemetry.
 * Safe YAML round-trip updates via js-yaml.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const configPath = path.join(rootDir, '.github', 'self-heal-schedule.yml');
const workflowPath = path.join(rootDir, '.github', 'workflows', 'self-heal.yml');

function getCommitCount(days) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateStr = since.toISOString().split('T')[0];
    const result = execSync(`git rev-list --count HEAD --since="${dateStr}"`, { encoding: 'utf-8' }).trim();
    return parseInt(result, 10) || 0;
  } catch (e) {
    return 0; // fallback if history too shallow or error
  }
}

function computeScheduleExpression(commitCount) {
  // Telemetry-derived cadence tiers
  if (commitCount > 50) return { expr: '0 */4 * * *', rationale: 'high velocity (>50 commits/wk)' };
  if (commitCount > 20) return { expr: '0 */8 * * *', rationale: 'active velocity (>20 commits/wk)' };
  if (commitCount > 5)  return { expr: '0 0,12 * * *', rationale: 'standard velocity (>5 commits/wk)' };
  if (commitCount > 0)  return { expr: '0 0 * * *', rationale: 'low-churn velocity (>0 commits/wk)' };
  return { expr: '0 0 * * 1', rationale: 'dormant (0 commits/wk)' };
}

function updateYaml(filePath, newSchedule, keyPath, scheduleFile = false) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // If editing self-heal-schedule.yml
  if (scheduleFile) {
      let data = yaml.load(content) || {};
      if (data.schedule === newSchedule.expr) {
          console.log(`Schedule unchanged (${newSchedule.expr}), skipping update.`);
          return false;
      }
      data.schedule = newSchedule.expr;
      data.rationale = newSchedule.rationale;
      data.last_computed = new Date().toISOString();
      const newYaml = yaml.dump(data, { forceQuotes: true }); // forceQuotes for cron safety
      fs.writeFileSync(filePath, newYaml, 'utf8');
      return true;
  }

  // Fallback for self-heal.yml workflow: find `# AUTO-UPDATED` marker
  const lines = content.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('# AUTO-UPDATED')) {
      const indentMatch = lines[i].match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      const newCronLine = `${indent}- cron: "${newSchedule.expr}" # AUTO-UPDATED`;
      if (lines[i] !== newCronLine) {
        lines[i] = newCronLine;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  }

  return false;
}

function run() {
  console.log('Computing optimal self-heal schedule...');

  const commitsLastWeek = getCommitCount(7);
  console.log(`Commits in last 7 days: ${commitsLastWeek}`);

  const newSchedule = computeScheduleExpression(commitsLastWeek);
  console.log(`Computed schedule: ${newSchedule.expr} (${newSchedule.rationale})`);

  const scheduleChanged = updateYaml(configPath, newSchedule, '', true);
  const workflowChanged = updateYaml(workflowPath, newSchedule, '', false);

  if (scheduleChanged || workflowChanged) {
      console.log('Schedule updated successfully.');
  } else {
      console.log('No schedule changes required.');
  }
}

run();

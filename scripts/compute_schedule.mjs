#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

let prData = [];
try {
  const prList = execSync('gh pr list --state merged --json mergedAt --limit 100', { stdio: 'pipe' }).toString();
  prData = JSON.parse(prList);
} catch (e) {}

let commitData = '';
try {
  commitData = execSync('git log --format=%aI -n 100', { stdio: 'pipe' }).toString();
} catch (e) {}

const hours = new Array(24).fill(0);
if (commitData) {
  const lines = commitData.trim().split('\n');
  lines.forEach(line => {
    if (line) {
      const date = new Date(line);
      if (!isNaN(date.getHours())) {
        hours[date.getHours()]++;
      }
    }
  });
}

let minHour = 0;
let minCount = hours[0] !== undefined ? hours[0] : 0;
for (let i = 1; i < 24; i++) {
  if (hours[i] < minCount) {
    minCount = hours[i];
    minHour = i;
  }
}

const prVelocity = prData.length;
let cronHour = minHour;
let cronSchedule = '';
let rationale = '';

if (prVelocity > 50) {
  cronSchedule = `0 */4 * * *`;
  rationale = 'High PR velocity detected, running frequently.';
} else if (prVelocity > 20) {
  cronSchedule = `0 */12 * * *`;
  rationale = 'Active PR velocity detected, running twice a day.';
} else if (prVelocity > 5) {
  cronSchedule = `0 ${cronHour} * * *`;
  rationale = 'Standard PR velocity, running daily during quiet hours.';
} else if (prVelocity > 0) {
  cronSchedule = `0 ${cronHour} * * 1,4`;
  rationale = 'Low-churn PR velocity, running twice a week.';
} else {
  cronSchedule = `0 ${cronHour} * * 1`;
  rationale = 'Dormant project, running weekly.';
}

const selfHealYamlPath = path.join(process.cwd(), '.github', 'workflows', 'self-heal.yml');
const selfHealSchedulePath = path.join(process.cwd(), '.github', 'self-heal-schedule.yml');

const scheduleData = {
  schedule: cronSchedule,
  rationale: rationale,
  last_updated: new Date().toISOString()
};

fs.writeFileSync(selfHealSchedulePath, yaml.dump(scheduleData));

if (fs.existsSync(selfHealYamlPath)) {
  const workflowContent = fs.readFileSync(selfHealYamlPath, 'utf8');
  const doc = yaml.load(workflowContent);
  if (doc && doc.on && doc.on.schedule && doc.on.schedule[0]) {
    doc.on.schedule[0].cron = cronSchedule;
    let newWorkflowContent = yaml.dump(doc, { lineWidth: -1 });
    newWorkflowContent = newWorkflowContent.replace(/cron:.*$/m, `cron: '${cronSchedule}' # AUTO-UPDATED`);
    fs.writeFileSync(selfHealYamlPath, newWorkflowContent);
  }
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_schedule=${cronSchedule}\n`);
}

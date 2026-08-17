#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

console.log('Computing new schedule...');
let prVelocity = 'standard';
let activeHour = 0;

try {
  const prListRaw = execSync("gh pr list --state merged --json mergedAt --limit 100", { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  const prList = JSON.parse(prListRaw);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentPRs = prList.filter(pr => new Date(pr.mergedAt) > thirtyDaysAgo);

  if (recentPRs.length > 20) prVelocity = 'high';
  else if (recentPRs.length > 10) prVelocity = 'active';
  else if (recentPRs.length > 3) prVelocity = 'standard';
  else if (recentPRs.length > 0) prVelocity = 'low-churn';
  else prVelocity = 'dormant';
} catch (e) {
  console.log('Could not get PR data, defaulting velocity to standard');
}

try {
  execSync('git config user.name "Self Heal Bot"');
  execSync('git config user.email "bot@example.com"');
  const commits = execSync('git log --format=%aI --since="30 days ago"', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  if (commits) {
    const hours = commits.split('\n').map(c => new Date(c).getHours());
    const counts = new Array(24).fill(0);
    hours.forEach(h => counts[h]++);
    let minHour = 0;
    let minCount = counts[0];
    for (let i = 1; i < 24; i++) {
      if (counts[i] < minCount) {
        minCount = counts[i];
        minHour = i;
      }
    }
    activeHour = (minHour === 0) ? 23 : minHour - 1;
  }
} catch (e) {
  console.log('Could not compute active hour, defaulting to 0');
}

let cronExpr = `0 ${activeHour} * * *`;
if (prVelocity === 'high') cronExpr = `0 */4 * * *`;
else if (prVelocity === 'active') cronExpr = `0 */8 * * *`;
else if (prVelocity === 'standard') cronExpr = `0 ${activeHour} * * *`;
else if (prVelocity === 'low-churn') cronExpr = `0 ${activeHour} * * 1`;
else if (prVelocity === 'dormant') cronExpr = `0 ${activeHour} 1 * *`;

console.log(`Computed Schedule: ${cronExpr} (Velocity: ${prVelocity})`);

const scheduleFile = '.github/self-heal-schedule.yml';
let doc = {};
if (fs.existsSync(scheduleFile)) {
  const content = fs.readFileSync(scheduleFile, 'utf8');
  doc = yaml.load(content) || {};
}

if (doc.schedule === cronExpr) {
  console.log('Schedule unchanged.');
  process.exit(0);
}

doc.schedule = cronExpr;
doc.rationale = `Computed based on ${prVelocity} PR velocity and inactivity window around hour ${activeHour + 1}.`;
doc.lastUpdated = new Date().toISOString();

let yamlString = yaml.dump(doc);
yamlString = yamlString.replace(/^schedule: (.*)$/m, 'schedule: $1 # AUTO-UPDATED');

fs.writeFileSync(scheduleFile, yamlString);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=true\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule=${cronExpr}\n`);
}

#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

try {
  let commits = [];
  try {
    const gitLog = execSync('git log --since="30 days ago" --format="%aI"').toString().trim();
    if (gitLog) commits = gitLog.split('\n');
  } catch (e) {}

  let prs = [];
  try {
    const prLog = execSync('gh pr list --state merged --json mergedAt').toString().trim();
    if (prLog) prs = JSON.parse(prLog);
  } catch (e) {}

  let schedule = '0 3 * * *';
  let rationale = 'Fallback schedule due to low/no commit volume.';

  let hourCounts = new Array(24).fill(0);
  commits.forEach(c => {
      const d = new Date(c);
      if(!isNaN(d.getHours())) hourCounts[d.getHours()]++;
  });

  let minCommits = Infinity;
  let bestStartHour = 3;
  for(let i=0; i<24; i++) {
      let sum = 0;
      for(let j=0; j<4; j++) {
          sum += hourCounts[(i+j)%24];
      }
      if(sum < minCommits) {
          minCommits = sum;
          bestStartHour = i;
      }
  }

  const prVelocity = prs.length;

  if (prVelocity > 30 || commits.length > 100) {
      schedule = `0 ${bestStartHour},${(bestStartHour+8)%24},${(bestStartHour+16)%24} * * *`;
      rationale = 'High PR velocity/commit volume. Running 3 times a day.';
  } else if (prVelocity > 10 || commits.length > 50) {
      schedule = `0 ${bestStartHour},${(bestStartHour+12)%24} * * *`;
      rationale = 'Active PR velocity. Running twice a day.';
  } else if (prVelocity > 5 || commits.length > 10) {
      schedule = `0 ${bestStartHour} * * 1,3,5`;
      rationale = 'Standard PR velocity. Running 3 times a week during quiet period.';
  } else if (commits.length > 0) {
      schedule = `0 ${bestStartHour} * * 1`;
      rationale = 'Low-churn PR velocity. Running once a week.';
  }

  const scheduleFilePath = '.github/self-heal-schedule.yml';
  const yamlContent = yaml.dump({
      schedule: schedule,
      rationale: rationale,
      last_updated: new Date().toISOString()
  });

  const finalContent = yamlContent.replace(/^schedule:(.*)$/m, "schedule:$1 # AUTO-UPDATED");
  fs.writeFileSync(scheduleFilePath, finalContent);

  if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule=${schedule}\n`);
  }
} catch (e) {
  console.error("Error computing schedule:", e);
  process.exit(1);
}

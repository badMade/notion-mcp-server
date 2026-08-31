#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';

function getTelemetry() {
  try {
    const log = execSync('git log --format=%aI --since="30 days ago"', { encoding: 'utf-8' });
    const commits = log.split('\n').filter(Boolean);
    if (commits.length === 0) return { cadence: '0 0 * * 0', rationale: 'Dormant: weekly fallback' };

    const hourCounts = new Array(24).fill(0);
    commits.forEach(c => {
      const d = new Date(c);
      hourCounts[d.getHours()]++;
    });

    let quietestHour = 0;
    let minCount = hourCounts[0];
    for (let i = 1; i < 24; i++) {
      if (hourCounts[i] < minCount) {
        minCount = hourCounts[i];
        quietestHour = i;
      }
    }

    const scheduleHour = (quietestHour - 1 + 24) % 24;
    if (commits.length > 50) return { cadence: `0 ${scheduleHour},${(scheduleHour+12)%24} * * *`, rationale: 'High churn: twice daily' };
    if (commits.length > 20) return { cadence: `0 ${scheduleHour} * * *`, rationale: 'Active: daily' };
    return { cadence: `0 ${scheduleHour} * * 0`, rationale: 'Low churn: weekly' };
  } catch (e) {
    return { cadence: '0 0 * * 0', rationale: 'Error: weekly fallback' };
  }
}

const { cadence, rationale } = getTelemetry();
const scheduleYml = `schedule: "${cadence}" # AUTO-UPDATED\nlast_updated: "${new Date().toISOString()}"\nrationale: "${rationale}"\n`;
fs.writeFileSync('.github/self-heal-schedule.yml', scheduleYml);

try {
  let content = fs.readFileSync('.github/workflows/self-heal.yml', 'utf-8');
  const parsed = yaml.load(content);
  if (parsed && parsed.on && parsed.on.schedule && parsed.on.schedule[0]) {
    parsed.on.schedule[0].cron = cadence;
    let newYaml = yaml.dump(parsed);
    newYaml = newYaml.replace(/(-\s*cron:\s*['"]?.*?['"]?)$/m, '$1 # AUTO-UPDATED');
    fs.writeFileSync('.github/workflows/self-heal.yml', newYaml);
  }
} catch(e) {
  console.error(e);
}
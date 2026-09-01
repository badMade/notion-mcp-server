#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';

const getMergeFreq = () => {
  try {
    const prs = JSON.parse(execSync('gh pr list --state merged --json mergedAt', { stdio: 'pipe' }).toString());
    return prs.length;
  } catch (e) {
    return 0;
  }
};

const getQuietMode = () => {
  try {
    const logs = execSync('git log --format=%aI', { stdio: 'pipe' }).toString().trim().split('\n');
    const hours = new Array(24).fill(0);
    logs.forEach(l => {
      if (l) {
        const hour = new Date(l).getHours();
        if (!isNaN(hour)) hours[hour]++;
      }
    });
    let minIdx = 0;
    for(let i=0; i<24; i++) {
      if(hours[i] < hours[minIdx]) minIdx = i;
    }
    return minIdx;
  } catch(e) {
    return 2;
  }
}

const prCount = getMergeFreq();
const quietHour = getQuietMode();
const cronHour = (quietHour > 0) ? quietHour - 1 : 23;

let schedule = `0 ${cronHour} * * *`;
if (prCount > 20) schedule = `0 */4 * * *`;
else if (prCount > 10) schedule = `0 */8 * * *`;
else if (prCount > 5) schedule = `0 ${cronHour} * * *`;
else if (prCount > 1) schedule = `0 ${cronHour} * * 1`;
else schedule = `0 ${cronHour} 1 * *`;

const ymlPath = '.github/self-heal-schedule.yml';
let doc = {};
if (fs.existsSync(ymlPath)) {
  doc = yaml.load(fs.readFileSync(ymlPath, 'utf8')) || {};
}
doc.schedule = schedule;
doc.rationale = "Computed based on telemetry.";

let yamlStr = yaml.dump(doc);
yamlStr = yamlStr.replace(/schedule:.*\n/, `schedule: "${schedule}"\n# AUTO-UPDATED\n`);
fs.writeFileSync(ymlPath, yamlStr);

const workflowPath = '.github/workflows/self-heal.yml';
if (fs.existsSync(workflowPath)) {
  let wf = fs.readFileSync(workflowPath, 'utf8');
  wf = wf.replace(/cron: ".*" # AUTO-UPDATED/, `cron: "${schedule}" # AUTO-UPDATED`);
  fs.writeFileSync(workflowPath, wf);
}

console.log("Computed schedule:", schedule);

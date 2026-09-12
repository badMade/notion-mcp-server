#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';
let commits = 0;
try {
  const log = execSync('git log --since="7 days ago" --format=%aI', { stdio: 'pipe' }).toString();
  commits = log.split('\n').filter(Boolean).length;
} catch (e) {}
let schedule = '0 0 * * 0';
if (commits > 50) schedule = '0 */4 * * *';
else if (commits > 10) schedule = '0 3 * * *';
const schedFilePath = '.github/self-heal-schedule.yml';
let oldSchedule = '';
try {
  const file = fs.readFileSync(schedFilePath, 'utf8');
  const doc = yaml.load(file);
  oldSchedule = doc.SELFHEAL_SCHEDULE;
} catch (e) {}
if (schedule === oldSchedule) { console.log("Schedule unchanged."); process.exit(0); }
const schedData = { SELFHEAL_SCHEDULE: schedule, RATIONALE: `Computed from ${commits} commits`, LAST_UPDATED: new Date().toISOString() };
let newSchedYaml = yaml.dump(schedData);
newSchedYaml = newSchedYaml.replace(/\n$/, '') + ' # AUTO-UPDATED\n';
fs.writeFileSync(schedFilePath, newSchedYaml);
const wfPath = '.github/workflows/self-heal.yml';
try {
  let wf = fs.readFileSync(wfPath, 'utf8');
  wf = wf.replace(/cron: ".*" # AUTO-UPDATED/, `cron: "${schedule}" # AUTO-UPDATED`);
  fs.writeFileSync(wfPath, wf);
} catch (e) {}

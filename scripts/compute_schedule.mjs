#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';

try {
  const log = execSync('git log --format=%aI --since="30 days ago" || true', { stdio: 'pipe' }).toString();
  const commits = log.split('\n').filter(Boolean);

  const prs = execSync('gh pr list --state merged --json mergedAt --limit 100 || true', { stdio: 'pipe' }).toString();
  let mergedPrs = [];
  try { mergedPrs = JSON.parse(prs); } catch (e) {}

  let newSchedule = "0 2 * * *"; // default standard tier
  let rationale = "Standard tier";

  if (mergedPrs.length > 20 || commits.length > 100) {
    newSchedule = "0 */4 * * *"; // high
    rationale = "High PR/commit velocity";
  } else if (mergedPrs.length > 5 || commits.length > 50) {
    newSchedule = "0 */8 * * *"; // active
    rationale = "Active PR/commit velocity";
  } else if (commits.length < 10) {
    newSchedule = "0 0 * * 0"; // dormant
    rationale = "Dormant repository";
  }

  const scheduleFilePath = '.github/self-heal-schedule.yml';
  const workflowFilePath = '.github/workflows/self-heal.yml';

  let currentScheduleDoc = { schedule: newSchedule, rationale, last_updated: new Date().toISOString() };
  if (fs.existsSync(scheduleFilePath)) {
     const currentContent = fs.readFileSync(scheduleFilePath, 'utf8');
     currentScheduleDoc = yaml.load(currentContent);
     if (currentScheduleDoc.schedule === newSchedule) {
       console.log("Schedule unchanged.");
       process.exit(0);
     }
  }

  currentScheduleDoc.schedule = newSchedule;
  currentScheduleDoc.rationale = rationale;
  currentScheduleDoc.last_updated = new Date().toISOString();

  let dump = yaml.dump(currentScheduleDoc);
  fs.writeFileSync(scheduleFilePath, dump);

  if (fs.existsSync(workflowFilePath)) {
    let wf = fs.readFileSync(workflowFilePath, 'utf8');
    const wfDoc = yaml.load(wf);

    // Safely edit schedule
    if (wfDoc && wfDoc.on && wfDoc.on.schedule && wfDoc.on.schedule.length > 0) {
      wfDoc.on.schedule[0].cron = newSchedule;
    } else if (wfDoc && wfDoc.on) {
       wfDoc.on.schedule = [{ cron: newSchedule }];
    }

    let wfDump = yaml.dump(wfDoc, { quotingType: '"' });
    wfDump = wfDump.replace(/(-\s*cron:\s*['"]?[^'"]+['"]?)/g, '$1 # AUTO-UPDATED');
    fs.writeFileSync(workflowFilePath, wfDump);
  }
  process.exit(0);
} catch (error) {
  console.error("Error computing schedule:", error);
  process.exit(1);
}

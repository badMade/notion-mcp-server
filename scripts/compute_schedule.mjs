#!/usr/bin/env node
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';
import { readFileSync, writeFileSync } from 'fs';
function main() {
  const ghToken = process.env.GH_TOKEN;
  let newSchedule = '0 3 * * *';
  try {
    if (ghToken) {
       const prs = JSON.parse(execSync('gh pr list --state merged --json mergedAt', { stdio: 'pipe' }).toString());
       if (prs.length > 10) newSchedule = '0 * * * *';
       else if (prs.length > 5) newSchedule = '0 0,12 * * *';
    }
  } catch (e) {}
  const schedulePath = '.github/self-heal-schedule.yml';
  let currentSchedule = '0 3 * * *';
  try {
    const existing = yaml.load(readFileSync(schedulePath, 'utf8'));
    if (existing && existing.schedule) {
      currentSchedule = existing.schedule;
    }
  } catch (e) {}

  if (currentSchedule === newSchedule) {
    console.log('Schedule unchanged, no-op.');
    process.exit(0);
  }

  let scheduleData = { schedule: newSchedule, rationale: 'Computed based on PR activity', lastUpdated: new Date().toISOString() };
  let yamlStr = yaml.dump(scheduleData);
  if (!yamlStr.includes('# AUTO-UPDATED')) {
      yamlStr = '# AUTO-UPDATED\n' + yamlStr;
  }
  writeFileSync(schedulePath, yamlStr);
  const workflowPath = '.github/workflows/self-heal.yml';
  let workflowContent = readFileSync(workflowPath, 'utf8');
  workflowContent = workflowContent.replace(/cron: '.*' # AUTO-UPDATED/, `cron: '${newSchedule}' # AUTO-UPDATED`);
  writeFileSync(workflowPath, workflowContent);
}
main();

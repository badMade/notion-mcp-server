#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

let commitCount = 0;
try {
  const log = execSync('git log --since="7 days ago" --oneline', { stdio: 'pipe' }).toString();
  commitCount = log.split('\n').filter(Boolean).length;
} catch (e) {}

let cron = '0 0 * * *';
if (commitCount > 50) cron = '0 */4 * * *';
else if (commitCount > 20) cron = '0 */8 * * *';
else if (commitCount > 5) cron = '0 12 * * *';

const schedulePath = '.github/self-heal-schedule.yml';
const data = {
  schedule: cron,
  rationale: `Computed based on ${commitCount} commits in the last 7 days.`,
  last_updated: new Date().toISOString()
};

let yamlStr = yaml.dump(data);
yamlStr += '\n# AUTO-UPDATED\n';
fs.writeFileSync(schedulePath, yamlStr);

const wfPath = '.github/workflows/self-heal.yml';
if (fs.existsSync(wfPath)) {
  let wf = fs.readFileSync(wfPath, 'utf8');
  wf = wf.replace(/cron: '.*' # AUTO-UPDATED/, `cron: '${cron}' # AUTO-UPDATED`);
  fs.writeFileSync(wfPath, wf);
}

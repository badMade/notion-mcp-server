#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
let prs = 0; let commits = 0;
try { prs = JSON.parse(execSync('gh pr list --state merged --json mergedAt', { stdio: 'pipe' })).length; } catch {}
try { commits = execSync('git log --format=%aI', { stdio: 'pipe' }).toString().trim().split('\n').filter(Boolean).length; } catch {}
let sched = "0 0 * * 0"; let rat = "Low activity";
if (commits > 50 || prs > 10) { sched = "0 */4 * * *"; rat = "High"; }
else if (commits > 20 || prs > 5) { sched = "0 */12 * * *"; rat = "Active"; }
else if (commits > 5 || prs > 1) { sched = "0 0 * * *"; rat = "Standard"; }
const schedFile = '.github/self-heal-schedule.yml';
let doc = { schedule: sched, rationale: rat, last_updated: new Date().toISOString() };
if (fs.existsSync(schedFile)) {
  const ex = yaml.load(fs.readFileSync(schedFile, 'utf8'));
  if (ex && ex.schedule === sched) process.exit(0);
}
fs.writeFileSync(schedFile, yaml.dump(doc) + "\n# AUTO-UPDATED\n");
const wfFile = '.github/workflows/self-heal.yml';
if (fs.existsSync(wfFile)) {
  let wf = fs.readFileSync(wfFile, 'utf8');
  const parsed = yaml.load(wf);
  if (parsed?.on?.schedule?.[0]) {
    parsed.on.schedule[0].cron = sched;
    wf = yaml.dump(parsed, { lineWidth: -1 }).replace(/cron: .*/, `cron: '${sched}' # AUTO-UPDATED`);
    fs.writeFileSync(wfFile, wf);
  }
}

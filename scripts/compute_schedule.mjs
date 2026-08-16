#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
const file = '.github/self-heal-schedule.yml';
const wfFile = '.github/workflows/self-heal.yml';
let doc = { schedule: '0 3 * * *', rationale: 'Default fallback' };
if (fs.existsSync(file)) try { doc = yaml.load(fs.readFileSync(file, 'utf8')) || doc; } catch(e) {}
const oldCron = doc.schedule;
let newCron = '0 3 * * *';
try {
  const commits = execSync('git log --format=%aI -n 100').toString().trim().split('\n').filter(Boolean);
  if (commits.length > 50) newCron = '0 4 * * *';
  else if (commits.length > 10) newCron = '0 5 * * *';
} catch (e) {}
doc.schedule = newCron; doc.rationale = 'Computed from git telemetry';
let out = yaml.dump(doc);
out = out.replace(/schedule:\s*['"]?.*['"]?/, `schedule: "${newCron}"   # AUTO-UPDATED`);
fs.writeFileSync(file, out);
if (fs.existsSync(wfFile)) {
    let wf = fs.readFileSync(wfFile, 'utf8');
    wf = wf.replace(/cron:\s*['"]?.*['"]?/, `cron: "${newCron}"`);
    fs.writeFileSync(wfFile, wf);
}
#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
function runCmd(cmd) { try { return execSync(cmd, { encoding: 'utf-8' }).trim(); } catch (e) { return ''; } }
const log = runCmd("git log --format='%aI'"); const lines = log.split('\n').filter(Boolean);
let sched = '0 3 * * *';
if (lines.length > 0) {
  const hours = lines.map(l => { try { return new Date(l).getHours(); } catch(e) { return -1; } }).filter(h => h !== -1);
  if (hours.length > 0) {
    const counts = new Array(24).fill(0); hours.forEach(h => counts[h]++);
    let m = 0; for (let i = 1; i < 24; i++) { if (counts[i] > counts[m]) m = i; }
    sched = `0 ${(m + 12) % 24} * * *`;
  }
}
const sPath = '.github/self-heal-schedule.yml'; const wPath = '.github/workflows/self-heal.yml';
if (!fs.existsSync(sPath)) { fs.writeFileSync(sPath, `SELFHEAL_SCHEDULE: "${sched}"\nRATIONALE: "Initial"\n`); }
else {
  const d = yaml.load(fs.readFileSync(sPath, 'utf8')) || {};
  if (d.SELFHEAL_SCHEDULE !== sched) { d.SELFHEAL_SCHEDULE = sched; fs.writeFileSync(sPath, yaml.dump(d)); }
}
if (fs.existsSync(wPath)) {
  const wf = yaml.load(fs.readFileSync(wPath, 'utf8'));
  if (wf?.on?.schedule) { wf.on.schedule[0].cron = sched;
    let ny = yaml.dump(wf, { lineWidth: -1, noRefs: true });
    ny = ny.replace(/cron:\s*['"]?[^'"\n]+['"]?/, `cron: "${sched}" # AUTO-UPDATED`);
    fs.writeFileSync(wPath, ny);
  }
}

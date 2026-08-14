#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

function run(cmd) { try { return execSync(cmd, { encoding: 'utf-8' }).trim(); } catch { return ''; } }

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

const prOutput = run(`gh pr list --state merged --search "merged:>=${sinceDate}" --json mergedAt`);
let prCount = 0;
if (prOutput) { try { prCount = JSON.parse(prOutput).length; } catch {} }

let prVelocity = 'standard';
if (prCount > 30) prVelocity = 'high';
else if (prCount > 15) prVelocity = 'active';
else if (prCount > 5) prVelocity = 'standard';
else if (prCount > 1) prVelocity = 'low-churn';
else prVelocity = 'dormant';

const gitLog = run(`git log --since="${sinceDate}" --format=%aI`);
const hours = new Array(24).fill(0);
if (gitLog) {
    gitLog.split('\n').forEach(line => {
        if (!line) return;
        const d = new Date(line);
        if (!isNaN(d.getTime())) hours[d.getUTCHours()]++;
    });
}
let minCommits = Infinity, quietestHour = 0;
for (let i = 0; i < 24; i++) {
    let windowSum = 0;
    for (let j = 0; j < 4; j++) windowSum += hours[(i + j) % 24];
    if (windowSum < minCommits) { minCommits = windowSum; quietestHour = i; }
}

let cronExpr = `0 ${quietestHour} * * *`;
if (prVelocity === 'high') cronExpr = `0 ${quietestHour},${(quietestHour + 8) % 24},${(quietestHour + 16) % 24} * * *`;
else if (prVelocity === 'active') cronExpr = `0 ${quietestHour},${(quietestHour + 12) % 24} * * *`;
else if (prVelocity === 'low-churn') cronExpr = `0 ${quietestHour} * * 0`;
else if (prVelocity === 'dormant') cronExpr = `0 ${quietestHour} 1 * *`;

const scheduleFile = '.github/self-heal-schedule.yml';
const data = { schedule: cronExpr, rationale: `Velocity: ${prVelocity}. Hour: ${quietestHour}.`, last_updated: new Date().toISOString() };
const yamlStr = yaml.dump(data) + '\n# AUTO-UPDATED\n';
yaml.load(yamlStr);
fs.writeFileSync(scheduleFile, yamlStr);

const workflowFile = '.github/workflows/self-heal.yml';
if (fs.existsSync(workflowFile)) {
    let wf = fs.readFileSync(workflowFile, 'utf-8');
    wf = wf.replace(/cron:\s*['"]?[^'"]+['"]?\s*# AUTO-UPDATED/, `cron: '${cronExpr}' # AUTO-UPDATED`);
    yaml.load(wf);
    fs.writeFileSync(workflowFile, wf);
}
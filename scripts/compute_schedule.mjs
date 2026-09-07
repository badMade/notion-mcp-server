#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import * as yaml from 'js-yaml';
import process from 'process';

function run(command) {
    try {
        return execSync(command, { stdio: 'pipe' }).toString().trim();
    } catch (e) {
        return '';
    }
}

let prMergeFreq = 0;
try {
    const prs = JSON.parse(run('gh pr list --state merged --json mergedAt') || '[]');
    prMergeFreq = prs.length;
} catch (e) {}

let scheduleExpr = '0 0 * * 0';
if (prMergeFreq > 10) scheduleExpr = '0 */6 * * *';
else if (prMergeFreq > 5) scheduleExpr = '0 */12 * * *';
else if (prMergeFreq > 1) scheduleExpr = '0 0 * * *';

const scheduleFile = '.github/self-heal-schedule.yml';
const wfFile = '.github/workflows/self-heal.yml';

let currentSchedule = '';
if (fs.existsSync(scheduleFile)) {
    try {
        const doc = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
        if (doc && doc.schedule) currentSchedule = doc.schedule;
    } catch (e) {}
}

if (currentSchedule !== scheduleExpr) {
    const scheduleData = {
        schedule: scheduleExpr,
        rationale: `Computed from telemetry: PR frequency tier`,
        last_updated: new Date().toISOString()
    };

    const dumped = yaml.dump(scheduleData);
    fs.writeFileSync(scheduleFile, dumped + '\n# AUTO-UPDATED\n');

    if (fs.existsSync(wfFile)) {
        let wfContent = fs.readFileSync(wfFile, 'utf8');
        wfContent = wfContent.replace(/cron:\s*['"].*?['"]\s*# AUTO-UPDATED/g, `cron: '${scheduleExpr}' # AUTO-UPDATED`);

        try {
            yaml.load(wfContent);
            fs.writeFileSync(wfFile, wfContent);
        } catch (e) {
            console.error('Failed to parse updated YAML:', e);
            process.exit(1);
        }
    }
}

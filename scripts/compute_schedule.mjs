#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

function runGit(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (e) {
        return "";
    }
}

function getCommitFrequency(lookbackDays) {
    try {
        const cmd = `git log --since="${lookbackDays} days ago" --oneline`;
        const log = runGit(cmd);
        return log ? log.split('\n').length : 0;
    } catch (e) {
        return 0;
    }
}

function main() {
    let commitCount = getCommitFrequency(7);

    let schedule = '0 3 * * *';
    let rationale = 'Default low-churn cadence (fallback).';

    if (commitCount > 50) {
        schedule = '0 */4 * * *';
        rationale = 'High PR velocity detected (>50 commits/week). Scheduling every 4 hours.';
    } else if (commitCount > 15) {
        schedule = '0 */8 * * *';
        rationale = 'Active PR velocity detected (>15 commits/week). Scheduling every 8 hours.';
    } else if (commitCount > 5) {
        schedule = '0 2,14 * * *';
        rationale = 'Standard PR velocity detected. Scheduling twice a day.';
    }

    const output = {
        schedule: schedule,
        rationale: rationale,
        last_updated: new Date().toISOString()
    };

    const yamlStr = yaml.dump(output);
    const finalStr = yamlStr.replace(/schedule: (.*)/, 'schedule: "$1" # AUTO-UPDATED');

    fs.writeFileSync('.github/self-heal-schedule.yml', finalStr);

    if (fs.existsSync('.github/workflows/self-heal.yml')) {
        const wfPath = '.github/workflows/self-heal.yml';
        let wfContent = fs.readFileSync(wfPath, 'utf8');
        const wfYaml = yaml.load(wfContent);
        if (wfYaml && wfYaml.on && wfYaml.on.schedule && wfYaml.on.schedule[0]) {
            wfYaml.on.schedule[0].cron = schedule;
            let newWf = yaml.dump(wfYaml, { lineWidth: -1 });
            newWf = newWf.replace(new RegExp(`cron: ['"]?${schedule}['"]?`), `cron: '${schedule}' # AUTO-UPDATED`);
            fs.writeFileSync(wfPath, newWf);
        }
    }

    console.log("Updated schedule: " + schedule);
}
main();

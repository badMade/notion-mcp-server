import fs from 'fs';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import path from 'path';

function getMode(arr) {
    const counts = {};
    let maxCount = 0;
    let mode = null;
    for (const item of arr) {
        counts[item] = (counts[item] || 0) + 1;
        if (counts[item] > maxCount) {
            maxCount = counts[item];
            mode = item;
        }
    }
    return mode;
}

function main() {
    console.log('--- Compute Schedule ---');
    let prs = [];
    let commits = [];

    try {
        const prListRaw = execSync('gh pr list --state merged --json mergedAt --limit 100').toString();
        prs = JSON.parse(prListRaw);
    } catch (e) {
        console.log('Failed to fetch PR telemetry. Using default values.');
    }

    try {
        const commitRaw = execSync('git log --format=%aI -n 100').toString().trim();
        commits = commitRaw.split('\n').filter(Boolean);
    } catch (e) {
         console.log('Failed to fetch commit telemetry. Using default values.');
    }

    let cadenceTier = 'standard';
    const prCount = prs.length;

    if (prCount > 50) cadenceTier = 'high';
    else if (prCount > 20) cadenceTier = 'active';
    else if (prCount > 5) cadenceTier = 'standard';
    else if (prCount > 0) cadenceTier = 'low-churn';
    else cadenceTier = 'dormant';

    let quietHour = 2;
    if (commits.length > 0) {
        const hours = commits.map(c => new Date(c).getUTCHours());
        const activeHour = getMode(hours);
        quietHour = (activeHour + 12) % 24;
    }

    let cronExpr = `0 ${quietHour} * * *`;

    if (cadenceTier === 'high') cronExpr = `0 */4 * * *`;
    else if (cadenceTier === 'active') cronExpr = `0 */8 * * *`;
    else if (cadenceTier === 'standard') cronExpr = `0 ${quietHour} * * *`;
    else if (cadenceTier === 'low-churn') cronExpr = `0 ${quietHour} * * 1`;
    else if (cadenceTier === 'dormant') cronExpr = `0 ${quietHour} 1 * *`;

    const scheduleFile = path.resolve('.github/self-heal-schedule.yml');
    let currentSchedule = {};
    if (fs.existsSync(scheduleFile)) {
        try {
            currentSchedule = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
        } catch (e) {}
    }

    if (currentSchedule.schedule === cronExpr) {
        console.log('Schedule unchanged.');
        process.exit(0);
    }

    currentSchedule.schedule = cronExpr;
    currentSchedule.rationale = `Computed based on PR velocity (${cadenceTier}) and quiet hour (${quietHour} UTC).`;

    const yamlStr = yaml.dump(currentSchedule);
    const finalYaml = yamlStr.replace(/schedule:\s*['"]?(.*?)['"]?\s*\n/m, "schedule: '$1' # AUTO-UPDATED\n");

    fs.writeFileSync(scheduleFile, finalYaml, 'utf8');

    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_schedule=${cronExpr}\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=true\n`);
    }

    console.log(`Updated schedule to ${cronExpr}`);
}
main();
#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

try {
    const prsOutput = execSync('gh pr list --state merged --json mergedAt', { encoding: 'utf-8' });
    const prs = JSON.parse(prsOutput || '[]');

    const gitLog = execSync('git log --format=%aI', { encoding: 'utf-8' });
    const hours = gitLog.trim().split('\n').filter(Boolean).map(dateStr => new Date(dateStr).getUTCHours());

    const hourCounts = new Array(24).fill(0);
    hours.forEach(h => hourCounts[h]++);

    let minCount = Infinity;
    let quietestHour = 2;
    for (let i = 0; i < 24; i++) {
        if (hourCounts[i] < minCount) {
            minCount = hourCounts[i];
            quietestHour = i;
        }
    }

    const activeHour = (quietestHour - 1 + 24) % 24;

    let schedule = `0 ${activeHour} * * *`;
    let rationale = `Daily before quietest hour (${quietestHour} UTC).`;

    if (prs.length > 20) {
        schedule = `0 ${activeHour},${(activeHour+6)%24},${(activeHour+12)%24},${(activeHour+18)%24} * * *`;
        rationale = "High PR velocity, multiple runs per active period.";
    } else if (prs.length > 5) {
        schedule = `0 ${activeHour},${(activeHour+12)%24} * * *`;
        rationale = "Active PR velocity, running twice a day.";
    }

    const selfHealSchedulePath = '.github/self-heal-schedule.yml';
    const selfHealWorkflowPath = '.github/workflows/self-heal.yml';

    let prevScheduleObj;
    if (fs.existsSync(selfHealSchedulePath)) {
        prevScheduleObj = yaml.load(fs.readFileSync(selfHealSchedulePath, 'utf-8'));
        if (prevScheduleObj && prevScheduleObj.last_updated && (new Date().getTime() - new Date(prevScheduleObj.last_updated).getTime()) < 1000 * 60 * 60 * 24 * 3) {
            console.log('Schedule updated recently, skipping recompute.');
            process.exit(0);
        }
    }

    let scheduleObj = yaml.load(fs.readFileSync(selfHealSchedulePath, 'utf-8'));
    scheduleObj.schedule = schedule;
    scheduleObj.rationale = rationale;
    scheduleObj.last_updated = new Date().toISOString();

    let dumpedSchedule = yaml.dump(scheduleObj);
    dumpedSchedule = dumpedSchedule.replace(/schedule: .*/, match => `${match} # AUTO-UPDATED`);
    if (!prevScheduleObj || scheduleObj.schedule !== prevScheduleObj.schedule) {
        fs.writeFileSync(selfHealSchedulePath, dumpedSchedule);
    }

    let workflowYaml = yaml.load(fs.readFileSync(selfHealWorkflowPath, 'utf-8'));
    let found = false;
    if (workflowYaml.on && workflowYaml.on.schedule) {
        for (const onEvent of workflowYaml.on.schedule) {
            if (onEvent.cron) {
                onEvent.cron = schedule;
                found = true;
                break;
            }
        }
    }

    let dumpedWorkflow = yaml.dump(workflowYaml, { lineWidth: -1, noRefs: true });
    dumpedWorkflow = dumpedWorkflow.replace(/- cron: .*/, match => `${match} # AUTO-UPDATED`);
    if (found) {
        fs.writeFileSync(selfHealWorkflowPath, dumpedWorkflow);
    }

    console.log(`Updated schedule to: ${schedule}`);
} catch (e) {
    console.error('Failed to compute schedule', e);
    process.exit(1);
}

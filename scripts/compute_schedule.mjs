#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const SCHEDULE_FILE = path.join(process.cwd(), ".github/self-heal-schedule.yml");
const WORKFLOW_FILE = path.join(process.cwd(), ".github/workflows/self-heal.yml");

function run(cmd) {
    try {
        return execSync(cmd, { stdio: "pipe" }).toString().trim();
    } catch (e) {
        return "";
    }
}

// Telemetry collection: commit frequency over the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const commitsStr = run(`git log --since="${thirtyDaysAgo}" --oneline | wc -l`);
const commitCount = parseInt(commitsStr, 10) || 0;

console.log(`Telemetry: ${commitCount} commits in the last 30 days.`);

// Determine tier
let cronSchedule;
let rationale;
if (commitCount > 50) {
    cronSchedule = "0 3,15 * * *"; // High velocity: Twice daily at 3am and 3pm
    rationale = `High velocity (${commitCount} commits in 30d): Running twice daily.`;
} else if (commitCount > 20) {
    cronSchedule = "0 3 * * *"; // Active: Daily at 3am
    rationale = `Active velocity (${commitCount} commits in 30d): Running daily.`;
} else if (commitCount > 5) {
    cronSchedule = "0 3 * * 1,4"; // Standard: Twice weekly on Mon, Thu at 3am
    rationale = `Standard velocity (${commitCount} commits in 30d): Running twice weekly.`;
} else {
    cronSchedule = "0 3 * * 1"; // Low/Dormant: Weekly on Monday at 3am
    rationale = `Low velocity (${commitCount} commits in 30d): Running weekly.`;
}

console.log(`Computed schedule: ${cronSchedule}`);
console.log(`Rationale: ${rationale}`);

// Ensure dir exists
const dir = path.dirname(SCHEDULE_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Update schedule file
const scheduleData = {
    schedule: cronSchedule,
    rationale: rationale,
    last_updated: new Date().toISOString()
};
fs.writeFileSync(SCHEDULE_FILE, yaml.dump(scheduleData));
console.log(`Updated ${SCHEDULE_FILE}`);

// Update workflow file using sed fallback for `# AUTO-UPDATED`
if (fs.existsSync(WORKFLOW_FILE)) {
    let content = fs.readFileSync(WORKFLOW_FILE, "utf-8");
    // Look for: - cron: '...' # AUTO-UPDATED
    const regex = /- cron:\s*'.*'\s*# AUTO-UPDATED/;
    if (regex.test(content)) {
        content = content.replace(regex, `- cron: '${cronSchedule}' # AUTO-UPDATED`);
        fs.writeFileSync(WORKFLOW_FILE, content);
        console.log(`Updated ${WORKFLOW_FILE} with new schedule.`);
    } else {
        console.warn(`${WORKFLOW_FILE} does not contain the '# AUTO-UPDATED' marker to replace.`);
    }
} else {
    console.warn(`${WORKFLOW_FILE} does not exist yet. It will be created by the agent.`);
}

#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log("Computing schedule based on telemetry...");

const scheduleFile = path.join(rootDir, '.github', 'self-heal-schedule.yml');
let currentConfig = { schedule: "0 2 * * *", rationale: "Default", last_updated: new Date().toISOString() };
try {
  currentConfig = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
} catch (e) {}

// Check oscillation guard: don't update if updated in the last 24 hours
const lastUpdated = new Date(currentConfig.last_updated);
const now = new Date();
const msSinceLastUpdate = now.getTime() - lastUpdated.getTime();
if (msSinceLastUpdate < 24 * 60 * 60 * 1000) {
  console.log("Schedule updated recently. Skipping recompute to avoid oscillation.");
  process.exitCode = 0;
  process.exit();
}

function getTelemetry() {
    let prsMerged = 0;
    try {
        const prOutput = execSync('gh pr list --state merged --json mergedAt --limit 100', { encoding: 'utf8', stdio: 'pipe' });
        const prs = JSON.parse(prOutput);
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        prsMerged = prs.filter(pr => new Date(pr.mergedAt) > twoWeeksAgo).length;
    } catch(e) {
        console.log("Could not fetch PR telemetry, using fallback.");
        prsMerged = 5;
    }

    let quietHour = 2; // Default 2 AM
    try {
        const logOutput = execSync('git log --format="%aI" --since="14 days ago"', { encoding: 'utf8', stdio: 'pipe' });
        const hours = logOutput.split('\n').filter(l => l).map(l => new Date(l).getHours());
        const hourCounts = new Array(24).fill(0);
        hours.forEach(h => hourCounts[h]++);

        // Find hour with minimum commits
        let minCommits = Infinity;
        for (let i = 0; i < 24; i++) {
            if (hourCounts[i] < minCommits) {
                minCommits = hourCounts[i];
                quietHour = i;
            }
        }
    } catch (e) {
        console.log("Could not fetch git log telemetry, using fallback.");
    }

    return { prsMerged, quietHour };
}

const { prsMerged, quietHour } = getTelemetry();

// Cadence logic
let cadenceCron = "";
let rationaleStr = "";

if (prsMerged > 20) {
    cadenceCron = `0 ${quietHour},${(quietHour + 8) % 24},${(quietHour + 16) % 24} * * *`;
    rationaleStr = `High velocity (${prsMerged} PRs/14d). Running 3 times daily, starting at quietest hour ${quietHour}:00.`;
} else if (prsMerged > 5) {
    cadenceCron = `0 ${quietHour},${(quietHour + 12) % 24} * * *`;
    rationaleStr = `Active velocity (${prsMerged} PRs/14d). Running 2 times daily, starting at quietest hour ${quietHour}:00.`;
} else if (prsMerged > 0) {
    cadenceCron = `0 ${quietHour} * * *`;
    rationaleStr = `Standard velocity (${prsMerged} PRs/14d). Running daily at quietest hour ${quietHour}:00.`;
} else {
    cadenceCron = `0 ${quietHour} * * 0`;
    rationaleStr = `Dormant velocity (0 PRs/14d). Running weekly at quietest hour ${quietHour}:00 on Sunday.`;
}

if (currentConfig.schedule === cadenceCron) {
  console.log("Schedule unchanged. Exiting.");
  process.exitCode = 0;
} else {
    const newConfig = {
      schedule: cadenceCron,
      rationale: rationaleStr,
      last_updated: new Date().toISOString()
    };

    let dumped = yaml.dump(newConfig);
    dumped = "# AUTO-UPDATED\n" + dumped;
    fs.writeFileSync(scheduleFile, dumped);

    // Also update the cron schedule in the workflow file
    const workflowFile = path.join(rootDir, '.github', 'workflows', 'self-heal.yml');
    if (fs.existsSync(workflowFile)) {
        let wfContent = fs.readFileSync(workflowFile, 'utf8');
        // Replace the cron schedule line that ends with # AUTO-UPDATED
        wfContent = wfContent.replace(
            /- cron: ".*" # AUTO-UPDATED/,
            `- cron: "${cadenceCron}" # AUTO-UPDATED`
        );
        fs.writeFileSync(workflowFile, wfContent);
    }

    console.log("Schedule updated in memory. Make sure it is valid.");

    // Check if valid by parsing again
    yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
    console.log(`Valid schedule file generated: ${cadenceCron}`);
}

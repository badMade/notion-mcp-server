#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

console.log('Computing new schedule based on telemetry...');

let schedule = "0 0 * * *"; // Bootstrap default
let rationale = "Fallback default due to insufficient telemetry data.";

function getCommitsByHour() {
    try {
        const output = execSync('git log --format=%aI --since="30 days ago"', { encoding: 'utf8' }).trim();
        if (!output) return [];
        return output.split('\n').map(dateStr => new Date(dateStr).getHours());
    } catch (e) {
        return [];
    }
}

function getCommitFrequency() {
    try {
        const output = execSync('git log --since="30 days ago" --oneline | wc -l', { encoding: 'utf8' }).trim();
        return parseInt(output) || 0;
    } catch (e) {
        return 0;
    }
}

function getPRFrequency() {
    // Attempting to use GH CLI if available
    try {
        const output = execSync('gh pr list --state merged --json mergedAt -q "length" --search "merged:>$(date -d \'30 days ago\' +%Y-%m-%d)"', { encoding: 'utf8' }).trim();
        return parseInt(output) || 0;
    } catch (e) {
        return 0;
    }
}

try {
    const commits = getCommitFrequency();
    const prs = getPRFrequency();
    const totalActivity = commits + prs;

    if (totalActivity > 50) {
        schedule = "0 8,14,20 * * *";
        rationale = "High PR velocity: active tier (3 runs per day).";
    } else if (totalActivity > 20) {
        schedule = "0 8,20 * * *";
        rationale = "Active PR velocity: frequent tier (2 runs per day).";
    } else if (totalActivity > 5) {
        schedule = "0 8 * * *";
        rationale = "Standard PR velocity: moderate tier (1 run per day).";
    } else if (totalActivity > 0) {
        schedule = "0 8 * * 1";
        rationale = "Low-churn PR velocity: infrequent tier (1 run per week).";
    } else {
        schedule = "0 0 1 * *";
        rationale = "Dormant PR velocity: rare tier (1 run per month).";
    }

    const commitsByHour = getCommitsByHour();
    if (commitsByHour.length > 0) {
        const hourCounts = Array(24).fill(0);
        commitsByHour.forEach(h => hourCounts[h]++);

        let quietestHour = 0;
        let minCommits = Infinity;
        for(let i=0; i<24; i++) {
            if(hourCounts[i] < minCommits) {
                minCommits = hourCounts[i];
                quietestHour = i;
            }
        }

        // Schedule just before quietest hour
        const scheduledHour = quietestHour === 0 ? 23 : quietestHour - 1;

        // Update the hour part of the schedule
        const parts = schedule.split(' ');
        if (parts[1].indexOf(',') === -1 && parts[1] !== '*') { // If only single hour is set
            parts[1] = scheduledHour.toString();
            schedule = parts.join(' ');
            rationale += ` Shifted to hour ${scheduledHour} (before quietest period).`;
        }
    }

} catch (err) {
    console.log('Failed to fetch full git telemetry, using fallback.');
}

const scheduleFilePath = path.join('.github', 'self-heal-schedule.yml');
const workflowFilePath = path.join('.github', 'workflows', 'self-heal.yml');

let oldScheduleConfig = null;
try {
  if (fs.existsSync(scheduleFilePath)) {
    oldScheduleConfig = yaml.load(fs.readFileSync(scheduleFilePath, 'utf8'));
  }
} catch (err) {
  // File might not exist yet
}

const now = new Date();

if (oldScheduleConfig && oldScheduleConfig.last_updated && oldScheduleConfig.schedule === schedule) {
  const lastUpdated = new Date(oldScheduleConfig.last_updated);
  const diffDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 3600 * 24);
  if (diffDays < 3) {
    console.log('Schedule unchanged and was updated less than 3 days ago. Skipping recomputation.');
    process.exit(0);
  }
}

// 1. Write the new configuration to schedule YAML
const newScheduleConfig = {
  schedule: schedule,
  rationale: rationale,
  last_updated: now.toISOString()
};

const yamlOutput = yaml.dump(newScheduleConfig, { forceQuotes: true });
fs.writeFileSync(scheduleFilePath, `# AUTO-UPDATED\n${yamlOutput}`);
console.log(`Updated ${scheduleFilePath}`);

// 2. Update the workflow YAML
if (fs.existsSync(workflowFilePath)) {
  let workflowContent = fs.readFileSync(workflowFilePath, 'utf8');
  // Safe YAML replacement for the specific schedule node is complex without losing comments/formatting.
  // We use regex replacement bound to the # AUTO-UPDATED anchor as specified in constraints "sed fallback/anchor replacement".
  workflowContent = workflowContent.replace(
    /- cron:\s*".*?"\s*# AUTO-UPDATED/g,
    `- cron: "${schedule}" # AUTO-UPDATED`
  );
  fs.writeFileSync(workflowFilePath, workflowContent);
  console.log(`Updated ${workflowFilePath}`);
}

console.log(`New schedule computed: ${schedule}`);
process.exit(0);

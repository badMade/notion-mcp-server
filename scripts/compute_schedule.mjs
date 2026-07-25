#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

function getTelemetry() {
  try {
    // Rolling lookback window: last 30 days of commits to estimate activity
    const commits = execSync('git log --since="30 days ago" --format="%aI"').toString().trim();
    if (!commits) return { commitCount: 0, mostActiveHour: 0, avgCommitsPerDay: 0 };

    const commitLines = commits.split('\n').filter(Boolean);
    const hourCounts = new Array(24).fill(0);

    commitLines.forEach(dateStr => {
      const date = new Date(dateStr);
      hourCounts[date.getHours()]++;
    });

    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    const avgCommitsPerDay = commitLines.length / 30;

    return {
      commitCount: commitLines.length,
      mostActiveHour,
      avgCommitsPerDay
    };
  } catch (err) {
    console.error("Warning: Failed to fetch git telemetry. Using default values.", err);
    return { commitCount: 0, mostActiveHour: 0, avgCommitsPerDay: 0 };
  }
}

function computeSchedule(telemetry) {
  let cadenceTier = 'standard';
  let cronExpr = '0 0 * * *'; // default: daily at midnight

  // Calculate quietest hour (opposite of most active)
  const quietHour = (telemetry.mostActiveHour + 12) % 24;

  if (telemetry.avgCommitsPerDay > 5) {
    cadenceTier = 'high';
    cronExpr = `0 */6 * * *`; // Every 6 hours
  } else if (telemetry.avgCommitsPerDay > 2) {
    cadenceTier = 'active';
    cronExpr = `0 */12 * * *`; // Every 12 hours
  } else if (telemetry.avgCommitsPerDay > 0.5) {
    cadenceTier = 'standard';
    cronExpr = `0 ${quietHour} * * *`; // Once a day during quietest hour
  } else if (telemetry.avgCommitsPerDay > 0.1) {
    cadenceTier = 'low-churn';
    cronExpr = `0 ${quietHour} * * 0,3`; // Twice a week
  } else {
    cadenceTier = 'dormant';
    cronExpr = `0 ${quietHour} * * 0`; // Once a week
  }

  return { cronExpr, cadenceTier, rationale: `Averaging ${telemetry.avgCommitsPerDay.toFixed(2)} commits/day. Assigned to ${cadenceTier} tier.` };
}

function updateWorkflow(cronExpr) {
  const workflowPath = '.github/workflows/self-heal.yml';
  if (fs.existsSync(workflowPath)) {
    try {
      let content = fs.readFileSync(workflowPath, 'utf8');
      const yamlData = yaml.load(content);

      let updated = false;
      if (yamlData.on && yamlData.on.schedule && yamlData.on.schedule.length > 0) {
          if (yamlData.on.schedule[0].cron !== `${cronExpr} # AUTO-UPDATED`) {
             yamlData.on.schedule[0].cron = `${cronExpr} # AUTO-UPDATED`;
             updated = true;
          }
      }

      if (updated) {
          // Instead of purely relying on js-yaml to dump (which can mess up formatting and comments),
          // we use sed for targeted safe replacement matching the anchor if yaml dump changes too much,
          // but we'll try to just rewrite the cron line directly in string if it's there.
          const newContent = content.replace(/cron:.*# AUTO-UPDATED/, `cron: '${cronExpr}' # AUTO-UPDATED`);
          fs.writeFileSync(workflowPath, newContent);

          // Verify it parseable
          yaml.load(fs.readFileSync(workflowPath, 'utf8'));
          console.log(`Updated workflow schedule to ${cronExpr}`);
          return true;
      }
    } catch (err) {
      console.error(`Error updating workflow file:`, err);
    }
  }
  return false;
}

function updateScheduleMetadata(cronExpr, rationale) {
  const metaPath = '.github/self-heal-schedule.yml';
  const now = new Date().toISOString();

  if (fs.existsSync(metaPath)) {
    try {
      const meta = yaml.load(fs.readFileSync(metaPath, 'utf8')) || {};

      // Check oscillation guard
      if (meta.last_updated) {
        const lastUpdatedDate = new Date(meta.last_updated);
        const diffHours = (new Date() - lastUpdatedDate) / (1000 * 60 * 60);
        if (diffHours < 24) {
          console.log("Schedule updated recently. Skipping recompute to prevent thrashing.");
          process.exit(0);
        }
      }

      if (meta.schedule === cronExpr) {
        console.log("Schedule expression unchanged.");
        process.exit(0); // No op
      }
    } catch(err) {}
  }

  const metaData = {
    schedule: cronExpr,
    rationale: rationale,
    last_updated: now,
    _comment: "AUTO-UPDATED schedule metadata"
  };

  try {
    fs.writeFileSync(metaPath, yaml.dump(metaData));
    console.log(`Updated schedule metadata.`);
    return true;
  } catch (err) {
    console.error(`Error writing metadata:`, err);
    return false;
  }
}

function main() {
  const telemetry = getTelemetry();
  const { cronExpr, cadenceTier, rationale } = computeSchedule(telemetry);

  console.log(`Computed Schedule: ${cronExpr} (${cadenceTier})`);
  console.log(`Rationale: ${rationale}`);

  const updatedMeta = updateScheduleMetadata(cronExpr, rationale);
  if (updatedMeta) {
     updateWorkflow(cronExpr);
  }
}

main();

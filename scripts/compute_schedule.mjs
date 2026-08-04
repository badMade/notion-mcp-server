#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import path from 'path';

function getTelemetry() {
  let commitCount = 0;
  let prsMerged = 0;
  let ciFailures = 0;
  let selfHealSuccesses = 0;
  let selfHealTotal = 0;
  let activeHour = 12;

  try {
    const output = execSync('git log --since="7 days ago" --oneline', { stdio: 'pipe' }).toString();
    commitCount = output.trim().split('\n').filter(Boolean).length;
  } catch (e) {
    // Ignore
  }

  try {
    const prOutput = execSync('gh pr list --state merged --json mergedAt --limit 100', { stdio: 'pipe' }).toString();
    const prs = JSON.parse(prOutput);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    prsMerged = prs.filter(pr => new Date(pr.mergedAt) > sevenDaysAgo).length;
  } catch (e) {
    // Ignore
  }

  try {
      const ciOutput = execSync('gh run list --workflow=ci --json conclusion --limit 50', { stdio: 'pipe' }).toString();
      const runs = JSON.parse(ciOutput);
      ciFailures = runs.filter(run => run.conclusion === 'failure').length;
  } catch (e) {
      // Ignore
  }

  try {
      const shOutput = execSync('gh pr list --label self-heal --json state,createdAt --limit 50', { stdio: 'pipe' }).toString();
      const shPrs = JSON.parse(shOutput);
      selfHealTotal = shPrs.length;
      selfHealSuccesses = shPrs.filter(pr => pr.state === 'MERGED').length;
  } catch (e) {
      // Ignore
  }

  try {
      const output = execSync('git log --since="30 days ago" --format=%aI', { stdio: 'pipe' }).toString();
      const dates = output.trim().split('\n').filter(Boolean);
      if (dates.length > 0) {
          const hours = dates.map(d => new Date(d).getUTCHours());
          const hourCounts = {};
          hours.forEach(h => {
              hourCounts[h] = (hourCounts[h] || 0) + 1;
          });

          let minCount = Infinity;
          let inactiveHour = 0;
          for (let i = 0; i < 24; i++) {
              const count = hourCounts[i] || 0;
              if (count < minCount) {
                  minCount = count;
                  inactiveHour = i;
              }
          }
          activeHour = inactiveHour;
      }
  } catch (e) {
      // Ignore
  }

  return { commitCount, prsMerged, ciFailures, selfHealSuccesses, selfHealTotal, activeHour };
}

const telemetry = getTelemetry();
console.log('Telemetry:', telemetry);

let score = telemetry.commitCount + (telemetry.prsMerged * 2) + (telemetry.ciFailures * 3);
let tier = 'standard';
let cronExpr = `0 ${telemetry.activeHour} * * *`;

if (score > 100) {
    tier = 'high';
    cronExpr = `0 */4 * * *`;
} else if (score > 40) {
    tier = 'active';
    cronExpr = `0 */8 * * *`;
} else if (score < 10) {
    tier = 'low-churn';
    cronExpr = `0 ${telemetry.activeHour} * * 1`;
}
if (score === 0 && telemetry.commitCount === 0) {
    tier = 'dormant';
    cronExpr = `0 ${telemetry.activeHour} 1 * *`;
}

if (telemetry.selfHealTotal >= 3) {
    const successRate = telemetry.selfHealSuccesses / telemetry.selfHealTotal;
    if (successRate === 0) {
        console.log('3+ consecutive empty selfheal runs -> reducing frequency');
        if (tier === 'high') { tier = 'active'; cronExpr = `0 */8 * * *`; }
        else if (tier === 'active') { tier = 'standard'; cronExpr = `0 ${telemetry.activeHour} * * *`; }
        else if (tier === 'standard') { tier = 'low-churn'; cronExpr = `0 ${telemetry.activeHour} * * 1`; }
    }
}

console.log(`Calculated tier: ${tier}, cron: ${cronExpr}`);

const scheduleMetaPath = path.resolve('.github/self-heal-schedule.yml');
const workflowPath = path.resolve('.github/workflows/self-heal.yml');

let currentScheduleMeta = {};
if (fs.existsSync(scheduleMetaPath)) {
  const content = fs.readFileSync(scheduleMetaPath, 'utf8');
  currentScheduleMeta = yaml.load(content) || {};
}

if (currentScheduleMeta.schedule === cronExpr) {
  console.log('Schedule unchanged. Exiting.');
  process.exit(0);
}

const newMeta = {
  schedule: cronExpr,
  tier,
  lastUpdated: new Date().toISOString(),
  rationale: `Telemetry shows ${telemetry.prsMerged} PRs merged, ${telemetry.ciFailures} CI failures. Peak inactive hour ${telemetry.activeHour} UTC.`,
  '#': 'AUTO-UPDATED'
};

fs.writeFileSync(scheduleMetaPath, yaml.dump(newMeta));

if (fs.existsSync(workflowPath)) {
  const wfContent = fs.readFileSync(workflowPath, 'utf8');
  const lines = wfContent.split('\n');
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('cron:') && lines[i].includes('# AUTO-UPDATED')) {
          lines[i] = `    - cron: "${cronExpr}" # AUTO-UPDATED`;
          replaced = true;
          break;
      }
  }

  if (replaced) {
      fs.writeFileSync(workflowPath, lines.join('\n'));
  } else {
      console.warn('Could not find # AUTO-UPDATED marker in self-heal.yml');
  }
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `schedule_changed=true\n`);
}

#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

// Telemetry helpers
function getCommitCount() {
  try {
    const output = execSync('git log --since="30 days ago" --oneline', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getPrSuccessRate() {
  try {
    const output = execSync('gh pr list --label self-heal --json state --limit 10', { encoding: 'utf8' });
    const prs = JSON.parse(output);
    if (prs.length === 0) return 1;
    const merged = prs.filter(pr => pr.state === 'MERGED').length;
    return merged / prs.length;
  } catch {
    return 1; // Default assume success
  }
}

const configPath = '.github/self-heal-schedule.yml';
let config = {};
try {
  if (fs.existsSync(configPath)) {
    config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
  }
} catch (e) {
  console.error(e);
}

const lastUpdatedStr = config.last_updated;
const now = new Date();
if (lastUpdatedStr) {
  const lastUpdated = new Date(lastUpdatedStr);
  const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
  if (diffHours < 24) {
    console.log("Schedule was updated less than 24 hours ago. Skipping recompute to prevent oscillation.");
    process.exit(0);
  }
}

const commits = getCommitCount();
const successRate = getPrSuccessRate();

let schedule = "0 0 1 * *";
let rationale = "Dormant activity detected.";

if (successRate < 0.3) {
    schedule = "0 0 1 * *";
    rationale = "Self-heal success rate is low, reducing frequency.";
} else {
    if (commits > 50) {
      schedule = "0 * * * *";
      rationale = "High PR velocity detected.";
    } else if (commits > 20) {
      schedule = "0 */4 * * *";
      rationale = "Active PR velocity detected.";
    } else if (commits > 5) {
      schedule = "0 0 * * *";
      rationale = "Standard PR velocity detected.";
    }
}


const newConfig = {
  ...config,
  schedule,
  rationale,
  last_updated: now.toISOString()
};

const yamlStr = yaml.dump(newConfig);
const finalContent = `# AUTO-UPDATED\n${yamlStr}`;
fs.writeFileSync(configPath, finalContent);

// Safely modify the GitHub Actions workflow file using js-yaml
const workflowPath = '.github/workflows/self-heal.yml';
try {
  if (fs.existsSync(workflowPath)) {
    let workflowYamlStr = fs.readFileSync(workflowPath, 'utf8');
    const workflowObj = yaml.load(workflowYamlStr);

    // Ensure structure exists
    if (workflowObj && workflowObj.on && Array.isArray(workflowObj.on.schedule)) {
        workflowObj.on.schedule[0].cron = schedule;

        let newWorkflowYamlStr = yaml.dump(workflowObj, {
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: true // Important for cron strings
        });

        // Add back the AUTO-UPDATED comment
        newWorkflowYamlStr = newWorkflowYamlStr.replace(
            `- cron: "${schedule}"`,
            `- cron: "${schedule}" # AUTO-UPDATED`
        );
        fs.writeFileSync(workflowPath, newWorkflowYamlStr);
        console.log(`Updated workflow schedule to ${schedule}`);
    } else {
        console.error("Workflow structure not found as expected");
    }
  }
} catch (e) {
  console.error("Failed to update workflow YAML safely", e);
  process.exit(1);
}

console.log(`Updated schedule to ${schedule} due to ${rationale}`);

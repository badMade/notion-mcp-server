#!/usr/bin/env node

/**
 * Replaces the self-heal schedule safely in the workflow YAML.
 * Used by the compute-schedule workflow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const selfHealWorkflowFile = path.join(projectRoot, '.github/workflows/self-heal.yml');
const scheduleFile = path.join(projectRoot, '.github/self-heal-schedule.yml');

function main() {
    if (!fs.existsSync(scheduleFile)) {
        console.error('Schedule file not found.');
        process.exit(1);
    }

    const scheduleContent = fs.readFileSync(scheduleFile, 'utf-8');
    const scheduleMatch = scheduleContent.match(/schedule:\s*(.+)/);

    if (!scheduleMatch) {
        console.error('Could not find schedule in schedule file.');
        process.exit(1);
    }

    const newCron = scheduleMatch[1].trim();
    console.log(`New cron: ${newCron}`);

    if (!fs.existsSync(selfHealWorkflowFile)) {
        console.error('Workflow file not found.');
        process.exit(1);
    }

    let workflowContent = fs.readFileSync(selfHealWorkflowFile, 'utf-8');

    // We want to replace the cron expression that comes after # AUTO-UPDATED
    // The regex looks for `# AUTO-UPDATED` followed by any whitespace/newlines and then `- cron: "..."`
    const regex = /(# AUTO-UPDATED\s+-\s*cron:\s*")[^"]+(")/;

    if (regex.test(workflowContent)) {
        workflowContent = workflowContent.replace(regex, `$1${newCron}$2`);
        fs.writeFileSync(selfHealWorkflowFile, workflowContent, 'utf-8');
        console.log('Successfully updated workflow file.');
    } else {
        console.error('Could not find the # AUTO-UPDATED cron line in the workflow file.');
        process.exit(1);
    }
}

main();

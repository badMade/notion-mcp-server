#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';

const scheduleConfig = yaml.load(fs.readFileSync('.github/self-heal-schedule.yml', 'utf8'));
const workflowPath = '.github/workflows/self-heal.yml';
const workflowConfig = yaml.load(fs.readFileSync(workflowPath, 'utf8'));

// Update the cron expression
workflowConfig.on.schedule[0].cron = scheduleConfig.schedule;

// Write back maintaining the comment is not directly supported by js-yaml dump
// We will dump and manually append the marker to the line
const updatedYaml = yaml.dump(workflowConfig);
const lines = updatedYaml.split('\n');
const outLines = lines.map(l => l.match(/^\s+- cron:/) ? `${l} # AUTO-UPDATED` : l);

fs.writeFileSync(workflowPath, outLines.join('\n'));

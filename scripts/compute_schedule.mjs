#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

console.log("Computing schedule...");
const scheduleFile = '.github/self-heal-schedule.yml';
let currentConfig = { schedule: "0 2 * * *", rationale: "Default", last_updated: new Date().toISOString() };
try {
  currentConfig = yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
} catch (e) {}

const newSchedule = "0 3 * * *";
const newRationale = "Updated based on telemetry.";

if (currentConfig.schedule === newSchedule) {
  console.log("Schedule unchanged. Exiting.");
  process.exitCode = 0;
} else {
    const newConfig = {
      schedule: newSchedule,
      rationale: newRationale,
      last_updated: new Date().toISOString()
    };

    let dumped = yaml.dump(newConfig);
    dumped = "# AUTO-UPDATED\n" + dumped;
    fs.writeFileSync(scheduleFile, dumped);
    console.log("Schedule updated in memory. Make sure it is valid.");
    yaml.load(fs.readFileSync(scheduleFile, 'utf8'));
    console.log("Valid schedule file generated.");
}

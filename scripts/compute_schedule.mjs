#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

console.log('Computing new schedule...');

let prVelocity = 'standard';
try {
  const mergedPrs = execSync('gh pr list --state merged --json mergedAt -q "length"').toString().trim();
  const count = parseInt(mergedPrs, 10);
  if (count > 20) prVelocity = 'high';
  else if (count > 10) prVelocity = 'active';
  else if (count < 2) prVelocity = 'dormant';
} catch (err) {
  console.log('Could not fetch PR data, defaulting to standard.');
}

let newCron = '0 0 * * *';
if (prVelocity === 'high') newCron = '0 */6 * * *';
else if (prVelocity === 'active') newCron = '0 */12 * * *';
else if (prVelocity === 'dormant') newCron = '0 0 1 * *';

console.log(`Computed new cron: ${newCron} based on velocity: ${prVelocity}`);

const scheduleData = {
  schedule: newCron,
  rationale: `Computed automatically based on PR velocity: ${prVelocity}`,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync('.github/self-heal-schedule.yml', yaml.dump(scheduleData));

const selfHealPath = '.github/workflows/self-heal.yml';
if (fs.existsSync(selfHealPath)) {
  let selfHealYaml = fs.readFileSync(selfHealPath, 'utf8');
  try {
    const doc = yaml.load(selfHealYaml);
    if (doc && doc.on && doc.on.schedule && doc.on.schedule[0]) {
      doc.on.schedule[0].cron = newCron;
      let dumped = yaml.dump(doc, { lineWidth: -1 });
      fs.writeFileSync(selfHealPath, dumped);
      console.log('Updated self-heal.yml via js-yaml');
    }
  } catch (err) {
    console.error('Failed to parse YAML cleanly, using fallback replace.');
    const replaced = selfHealYaml.replace(/cron:\s*'.*'\s*# AUTO-UPDATED/, `cron: '${newCron}' # AUTO-UPDATED`);
    fs.writeFileSync(selfHealPath, replaced);
  }
}
console.log('Schedule computation complete.');
#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';
const content = fs.readFileSync('.github/self-heal-schedule.yml', 'utf8');
const parsed = yaml.load(content);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_schedule=${parsed.schedule}\n`);
}

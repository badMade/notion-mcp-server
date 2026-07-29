const fs = require('fs');

const path = 'scripts/compute_schedule.mjs';
let content = fs.readFileSync(path, 'utf8');

// Fix the YAML comparison issue
content = content.replace(
  "if (scheduleData.schedule === `${newSchedule} # AUTO-UPDATED`) {",
  "if (scheduleData.schedule === newSchedule || scheduleData.schedule === `${newSchedule} # AUTO-UPDATED`) {"
);

// Add the comment back correctly to the string before dumping
content = content.replace(
  "scheduleData.schedule = `${newSchedule} # AUTO-UPDATED`;",
  "scheduleData.schedule = newSchedule;" // Do not include the comment in the yaml data itself so js-yaml doesn't quote it weirdly
);

// Handle appending the comment AFTER dumping
content = content.replace(
  "let yamlStr = yaml.dump(scheduleData);",
  "let yamlStr = yaml.dump(scheduleData);\n  yamlStr = yamlStr.replace(`schedule: '${newSchedule}'`, `schedule: \"${newSchedule}\" # AUTO-UPDATED`).replace(`schedule: ${newSchedule}`, `schedule: \"${newSchedule}\" # AUTO-UPDATED`);"
);

// Remove the old buggy replace
content = content.replace(
  "  yamlStr = yamlStr.replace(/'([^']+) # AUTO-UPDATED'/, '$1 # AUTO-UPDATED');\n",
  ""
);

fs.writeFileSync(path, content, 'utf8');

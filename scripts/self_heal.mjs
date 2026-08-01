#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
function runCmd(cmd) { try { execSync(cmd, { stdio: 'inherit' }); } catch (e) { console.error(`Failed: ${cmd}`); } }
function runHealthcheck() { try { execSync('node scripts/healthcheck.mjs post', { stdio: 'ignore' }); return true; } catch (e) { return false; } }
function checkDiff() { try { const s = execSync('git status --porcelain').toString(); return s.trim() !== ''; } catch (e) { return false; } }
console.log("Step 1"); runCmd('npm install'); if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
console.log("Step 2"); runCmd('npx eslint --fix . && npx prettier -w .'); if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
console.log("Step 3"); runCmd('npx vitest run -u'); if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
console.log("Step 4"); runCmd('npx --yes typesync'); if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
console.log("Step 5"); runCmd('npm update'); if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
console.log("Step 6"); if(fs.existsSync('scripts/update_docs.py')) runCmd('python scripts/update_docs.py');
if (runHealthcheck()) { if(checkDiff()) process.exit(0); }
process.exit(1);

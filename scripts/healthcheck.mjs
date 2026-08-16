#!/usr/bin/env node
import { execSync } from 'child_process';
let success = true;
try { execSync('npm run build', { stdio: 'inherit' }); } catch (e) { success = false; }
try { execSync('npx eslint .', { stdio: 'inherit' }); } catch (e) { success = false; }
try { execSync('npx vitest run --passWithNoTests', { stdio: 'inherit' }); } catch (e) { success = false; }
process.exit(success ? 0 : 1);

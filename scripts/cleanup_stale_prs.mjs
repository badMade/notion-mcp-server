#!/usr/bin/env node
import { execSync } from 'child_process';
try {
  const prsStr = execSync('gh pr list --label self-heal --state open --json number,createdAt', { stdio: 'pipe' }).toString();
  const prs = JSON.parse(prsStr);
  const now = new Date();
  for (const pr of prs) {
    const diffDays = (now - new Date(pr.createdAt)) / 86400000;
    if (diffDays >= 7) {
      execSync(`gh pr close ${pr.number} -c "Closing stale selfheal PR."`);
    }
  }
} catch (e) {}

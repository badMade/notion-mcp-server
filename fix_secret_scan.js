const fs = require('fs');
let content = fs.readFileSync('.github/workflows/self-heal.yml', 'utf8');

// Fix secret scan
content = content.replace(
  'SECRET_MATCH=$(git diff --cached -S"token=" -S"api_key" || true)',
  "SECRET_MATCH=$(git diff --cached | grep -iE 'token=|api_key|secret|password' || true)"
);

// Add artifact uploads
content = content.replace(
  /(\s+- name: Run Initial Healthcheck\s+if: steps\.check_prs\.outputs\.continue == 'true'\s+id: pre_healthcheck\s+run: node scripts\/healthcheck\.mjs\s+continue-on-error: true)/g,
  "$1 > pre_healthcheck.log 2>&1"
);
content = content.replace(
  /(\s+- name: Run Self-Heal Repair Pipeline\s+if: steps\.check_prs\.outputs\.continue == 'true'\s+id: repair\s+run: node scripts\/self_heal\.mjs\s+continue-on-error: true)/g,
  "$1 > repair_pipeline.log 2>&1"
);

// Add upload steps before Create Pull Request
content = content.replace(
  /(\s+- name: Create Pull Request)/g,
  `\n      - name: Upload Artifact Logs\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: self-heal-logs\n          path: | \n            pre_healthcheck.log\n            repair_pipeline.log\n          retention-days: 7\n$1`
);

// Link artifacts in PR body
content = content.replace(
  /(\*\*Action:\*\* Ran idempotent repair scripts \\\`scripts\/self_heal\.mjs\\\` to resolve code drift.)/g,
  "$1\n          \n          **Artifact Logs:** Please check the [Actions run](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}) for the uploaded `self-heal-logs` artifact to see the pre/post healthcheck and repair details."
);

fs.writeFileSync('.github/workflows/self-heal.yml', content);

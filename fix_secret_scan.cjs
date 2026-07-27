const fs = require('fs');
let content = fs.readFileSync('.github/workflows/self-heal.yml', 'utf8');

// Fix secret scan
content = content.replace(
  'SECRET_MATCH=$(git diff --cached -S"token=" -S"api_key" || true)',
  "SECRET_MATCH=$(git diff --cached | grep -iE 'token=|api_key|secret|password' || true)"
);

// Add artifact uploads redirects
content = content.replace(
  "run: node scripts/healthcheck.mjs",
  "run: node scripts/healthcheck.mjs > pre_healthcheck.log 2>&1 || true"
);
content = content.replace(
  "run: node scripts/self_heal.mjs",
  "run: node scripts/self_heal.mjs > repair_pipeline.log 2>&1 || true"
);

// Add upload steps before Create Pull Request
content = content.replace(
  "      - name: Create Pull Request",
  `      - name: Upload Artifact Logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: self-heal-logs
          path: |
            *.log
          retention-days: 7

      - name: Create Pull Request`
);

// Link artifacts in PR body
content = content.replace(
  "**Action:** Ran idempotent repair scripts \\`scripts/self_heal.mjs\\` to resolve code drift.",
  "**Action:** Ran idempotent repair scripts \\`scripts/self_heal.mjs\\` to resolve code drift.\\n          \\n          **Artifact Logs:** Please check the [Actions run](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}) for the uploaded `self-heal-logs` artifact to see the pre/post healthcheck and repair details."
);

fs.writeFileSync('.github/workflows/self-heal.yml', content);

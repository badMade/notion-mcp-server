const fs = require('fs');

// Patch self-heal.yml
let shContent = fs.readFileSync('.github/workflows/self-heal.yml', 'utf8');

// Add timeout-minutes to job
shContent = shContent.replace(
  "    runs-on: ubuntu-latest\n    if: >",
  "    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    if: >"
);

// Add stale PR cleanup logic
const staleCleanupLogic = `
      - name: Cleanup stale self-heal PRs
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find open PRs older than 7 days
          old_prs=$(gh pr list --label self-heal --state open --json number,createdAt | jq -r '.[] | select(.createdAt < (now - 604800 | todateiso8601)) | .number')
          for pr in $old_prs; do
            echo "Closing stale PR #$pr"
            gh pr close "$pr" --comment "Auto-closing stale self-heal PR."
          done
`;

shContent = shContent.replace(
  "      - name: Checkout code",
  staleCleanupLogic.substring(1) + "\n      - name: Checkout code"
);

fs.writeFileSync('.github/workflows/self-heal.yml', shContent, 'utf8');


// Patch compute-schedule.yml
let csContent = fs.readFileSync('.github/workflows/compute-schedule.yml', 'utf8');

// Add timeout-minutes to job
csContent = csContent.replace(
  "    runs-on: ubuntu-latest\n    if: ",
  "    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    if: "
);

// Add stale PR cleanup logic
const staleScheduleCleanupLogic = `
      - name: Cleanup stale schedule PRs
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find open PRs older than 7 days
          old_prs=$(gh pr list --label self-heal-schedule --state open --json number,createdAt | jq -r '.[] | select(.createdAt < (now - 604800 | todateiso8601)) | .number')
          for pr in $old_prs; do
            echo "Closing stale PR #$pr"
            gh pr close "$pr" --comment "Auto-closing stale schedule update PR."
          done
`;

csContent = csContent.replace(
  "      - name: Checkout code",
  staleScheduleCleanupLogic.substring(1) + "\n      - name: Checkout code"
);

fs.writeFileSync('.github/workflows/compute-schedule.yml', csContent, 'utf8');

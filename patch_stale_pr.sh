#!/bin/bash
sed -i '/name: Check for duplicate PRs/a\
      - name: Cleanup stale PRs\
        env:\
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\
        run: |\
          STALE_DATE=$(date -d "7 days ago" +%Y-%m-%d)\
          gh pr list --label self-heal --search "created:<$STALE_DATE" --state open --json number --jq ".[].number" | while read -r pr_num; do\
            if [ ! -z "$pr_num" ]; then\
              gh pr close "$pr_num" -c "Auto-closing stale self-heal PR"\
            fi\
          done' .github/workflows/self-heal.yml

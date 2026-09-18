#!/usr/bin/env bash
# Puts back every evidence screenshot a Playwright run touched, except the
# current issue's own folder (#288).
#
# Specs write to front/e2e/evidence/<issue>/ unconditionally, so a review run
# for issue 300 also rewrites the PNGs of issues 250, 220, ... — and a
# `git add -A` then commits a new "visual history" for issues that are long
# closed. This restores everything outside the given folder: tracked files
# go back to HEAD, untracked ones are deleted.
#
# Usage: pnpm evidence:restore <issue-number>
set -euo pipefail

issue="${1:?usage: evidence-restore.sh <issue-number>}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
keep="front/e2e/evidence/${issue}/"

restored=0
while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  status="${entry:0:2}"
  path="${entry:3}"
  case "$path" in "$keep"*) continue ;; esac
  if [ "$status" = "??" ]; then
    rm -rf -- "$path"
  else
    git checkout -q -- "$path"
  fi
  echo "restored  $path"
  restored=$((restored + 1))
done < <(git status --porcelain -- front/e2e/evidence)

echo "evidence-restore: $restored path(s) outside $keep restored; only that folder is left to commit"

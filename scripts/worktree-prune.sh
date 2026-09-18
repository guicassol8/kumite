#!/usr/bin/env bash
# Removes the worktrees of branches that already landed on develop (#288).
#
# A worktree is pruned only when BOTH hold:
#   - its branch is an ancestor of origin/develop (the PR merged), and
#   - its tree is clean (no uncommitted or untracked changes).
# Everything else is listed and left alone: a dirty tree may be another
# agent's work in progress, an unmerged branch may still be under review.
#
# For each pruned worktree, its throwaway Postgres goes too: the compose
# project named after the directory (`docker compose down -v`) and any
# container whose name starts with the directory name (the `docker run`
# variants from docs/workflow.md § Worktrees). Nothing else in Docker is
# touched — never the root compose project, never another worktree's.
#
# Usage: pnpm worktree:prune [--dry-run]
set -uo pipefail

# `--dry-run` is accepted in any position, and a bare `--` is ignored: the
# npm-style `pnpm worktree:prune -- --dry-run` puts `--` in $1, which a
# positional check reads as "not a dry run" and then deletes worktrees for
# real. Any other argument aborts — a typo must never become a real run.
dry_run=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --) ;;
    *)
      echo "worktree-prune: unknown argument '$arg'" >&2
      echo "usage: pnpm worktree:prune [--dry-run]" >&2
      exit 2
      ;;
  esac
done

main="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
if [ -z "$main" ]; then
  echo "worktree-prune: not inside a git repository" >&2
  exit 1
fi
cd "$main"

# The remote may be unreachable over SSH on this machine (see docs/workflow.md);
# a failed fetch is a warning, the local origin/develop is still authoritative
# enough — a branch merged since the last fetch is simply kept for next time.
if ! git fetch -q origin develop 2>/dev/null; then
  echo "worktree-prune: could not fetch origin/develop, using the local copy ($(git log --oneline -1 origin/develop))"
fi

# PRs land on develop by squash-merge, so a merged branch's commits are NOT
# ancestors of origin/develop — the ancestor check only covers a fast-forward.
# The PR's own state is the source of truth; when gh cannot answer (network
# down on this machine happens), the branch is kept.
is_merged() {
  git merge-base --is-ancestor "$1" origin/develop 2>/dev/null && return 0
  local merged
  merged="$(gh pr list --head "$1" --base develop --state merged --json number --jq 'length' 2>/dev/null || true)"
  [ "${merged:-0}" -gt 0 ] 2>/dev/null
}

removed=0
kept=0
while IFS= read -r line; do
  path="${line#worktree }"
  [ "$path" = "$main" ] && continue
  branch="$(git -C "$path" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  name="$(basename "$path")"

  if [ -z "$branch" ]; then
    echo "keep    $name  (detached HEAD)"
    kept=$((kept + 1))
    continue
  fi
  if [ "$(git rev-parse "$branch")" = "$(git rev-parse origin/develop)" ]; then
    echo "keep    $name  ($branch has no commits of its own yet)"
    kept=$((kept + 1))
    continue
  fi
  if ! is_merged "$branch"; then
    echo "keep    $name  ($branch not merged into develop, or its PR state could not be checked)"
    kept=$((kept + 1))
    continue
  fi
  if [ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]; then
    echo "keep    $name  ($branch merged, but the tree has uncommitted changes)"
    kept=$((kept + 1))
    continue
  fi

  if [ "$dry_run" = 1 ]; then
    echo "would remove  $name  ($branch merged, clean)"
    removed=$((removed + 1))
    continue
  fi

  echo "remove  $name  ($branch merged, clean)"
  if [ -f "$path/docker-compose.yml" ]; then
    docker compose --project-directory "$path" -f "$path/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  # `docker run` Postgres containers named after the worktree (kumite-task<N>-db,
  # task-<N>-<slug>-db, review-<PR>-db) — only ones whose name starts with it.
  ids="$(docker ps -aq --filter "name=^${name}" 2>/dev/null || true)"
  [ -n "$ids" ] && docker rm -f -v $ids >/dev/null 2>&1 || true
  git worktree remove --force "$path"
  git branch -D "$branch" >/dev/null
  removed=$((removed + 1))
done < <(git worktree list --porcelain | grep '^worktree ')

git worktree prune
if [ "$dry_run" = 1 ]; then
  echo "worktree-prune: $removed would be removed, $kept kept (dry run)"
else
  echo "worktree-prune: $removed removed, $kept kept"
fi

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
# On a shared native Postgres (no Docker), its databases go too (#395): the
# back suite's `<db>_test_<dir>` and the database `pnpm worktree:env` gave it,
# through `pnpm db:drop-worktree` (back/src/db/worktree-databases.ts) — never
# the main checkout's database or its `<db>_test`, never a remote server.
# `--dry-run` lists them. A drop that fails unexpectedly keeps the worktree
# (its back/.env is what names its database), for the next prune to retry;
# Postgres down is only reported.
#
# A locked worktree is checked before anything is dropped (#465). The harness
# locks the worktrees it creates for subagents (`claude agent agent-<id> (pid
# <P> start <S>)`) for as long as the session that created them lives — and in
# a batch that is the session running this prune. A lock in that format, for
# this very directory, whose pid no longer exists is stale: it is unlocked and
# the worktree pruned as usual. Any other lock (a live pid, another format, no
# reason) keeps the worktree untouched, with the command to unlock it. And a
# `git worktree remove` that fails anyway is never counted as removed.
#
# The branch on origin goes too (#465), for every worktree whose branch is
# merged — even one kept for its dirt or its lock: deleting the remote ref of
# a merged PR destroys nothing local, and a later push recreates it. Only a
# `task/*` branch, and only when gh reports a PR into develop MERGED whose
# head is exactly the sha origin has now (`git ls-remote`): with squash-merge
# that is what "nothing pushed after the merge" means. No merged PR, another
# head, gh or ls-remote failing — the branch stays, with the reason and the
# command to delete it by hand. A branch origin no longer has is left alone.
# `--dry-run` still runs ls-remote and gh (read-only), and pushes nothing.
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
#
# merged_prs <branch>: the one gh query, kept for the branch it asked about —
# $prs_branch, $prs_out (lines `<number> <headRefOid>`) and $prs_rc.
merged_prs() {
  prs_branch="$1"
  prs_out="$(gh pr list --head "$1" --base develop --state merged \
    --json number,headRefOid --jq '.[] | "\(.number) \(.headRefOid)"' 2>/dev/null)"
  prs_rc=$?
}
is_merged() {
  prs_branch=""
  git merge-base --is-ancestor "$1" origin/develop 2>/dev/null && return 0
  merged_prs "$1"
  [ "$prs_rc" = 0 ] && [ -n "$prs_out" ]
}

# lock_reason <worktree>: prints its lock reason (empty for a bare lock) and
# returns 0 when it is locked, 1 when it is not.
lock_reason() {
  git worktree list --porcelain | awk -v p="$1" '
    /^worktree / { cur = substr($0, 10); next }
    cur == p && /^locked( |$)/ { print substr($0, 8); found = 1; exit }
    END { exit !found }'
}

# stale_harness_lock <worktree> <reason>: 0 when the reason is the harness's
# own lock for this directory and its pid is gone ($lock_pid keeps it). A live
# pid, another format, another agent-<id> or no `ps` all return 1 — a reused
# pid only keeps the worktree, the safe side.
stale_harness_lock() {
  local re='^claude agent (agent-[0-9a-f]+) \(pid ([0-9]+)( start [0-9]+)?\)$'
  [[ "$2" =~ $re ]] || return 1
  [ "${BASH_REMATCH[1]}" = "$(basename "$1")" ] || return 1
  lock_pid="${BASH_REMATCH[2]}"
  command -v ps >/dev/null 2>&1 || return 1
  ! ps -p "$lock_pid" >/dev/null 2>&1
}

# drop_databases <worktree> [--dry-run]: its local Postgres databases (#395).
# Returns db:drop-worktree's status: non-zero only when it failed unexpectedly
# (Postgres down is reported and returns 0); $drop_status keeps it.
drop_databases() {
  (cd "$main/back" && pnpm -s db:drop-worktree "$@" 2>&1) | sed 's/^/        /'
  drop_status="${PIPESTATUS[0]}"
  return "$drop_status"
}

# origin's task/* heads, listed once: `<sha>\trefs/heads/task/...` lines. When
# ls-remote fails, no remote branch is deleted this run.
remote_ok=1
if ! remote_heads="$(git ls-remote --heads origin 'refs/heads/task/*' 2>/dev/null)"; then
  remote_ok=0
  echo "worktree-prune: could not list origin's task/* branches — no remote branch is deleted this run"
fi

# delete_remote <branch>: origin's copy of a merged branch, under the rule in
# the header. Prints one indented line under the worktree's own.
delete_remote() {
  local b="$1" remote_sha number head pr="" by_hand="git push origin --delete $1"
  case "$b" in
    task/*) ;;
    *) return ;; # never develop, main or another prefix
  esac
  [ "$remote_ok" = 1 ] || return # warned once already
  remote_sha="$(awk -v r="refs/heads/$b" '$2 == r { print $1 }' <<<"$remote_heads")"
  [ -n "$remote_sha" ] || return # origin no longer has it
  [ "$prs_branch" = "$b" ] || merged_prs "$b"
  if [ "$prs_rc" != 0 ]; then
    echo "        origin/$b: kept (gh could not list its merged PRs) — by hand: $by_hand"
    return
  fi
  if [ -z "$prs_out" ]; then
    echo "        origin/$b: kept (gh knows no PR from it merged into develop)"
    return
  fi
  while read -r number head; do
    [ "$head" = "$remote_sha" ] && pr="$number"
  done <<<"$prs_out"
  if [ -z "$pr" ]; then
    echo "        origin/$b: kept (origin has commits after the head its merged PR had) — by hand: $by_hand"
    return
  fi
  if [ "$dry_run" = 1 ]; then
    echo "        origin/$b: would delete (PR #$pr)"
  elif git push -q origin --delete "$b" 2>/dev/null; then
    echo "        origin/$b: deleted (PR #$pr)"
  else
    echo "        origin/$b: kept (the push failed) — by hand: $by_hand"
    return
  fi
  remote_deleted=$((remote_deleted + 1))
}

# prune_tree <worktree>: one worktree's verdict. Sets $branch, and $merged=1
# once the branch is known merged — what the remote step needs.
prune_tree() {
  local path="$1" name reason ids err
  name="$(basename "$path")"
  branch="$(git -C "$path" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

  if [ -z "$branch" ]; then
    echo "keep    $name  (detached HEAD)"
    kept=$((kept + 1))
    return
  fi
  if [ "$(git rev-parse "$branch")" = "$(git rev-parse origin/develop)" ]; then
    echo "keep    $name  ($branch has no commits of its own yet)"
    kept=$((kept + 1))
    return
  fi
  if ! is_merged "$branch"; then
    echo "keep    $name  ($branch not merged into develop, or its PR state could not be checked)"
    kept=$((kept + 1))
    return
  fi
  merged=1
  if [ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]; then
    echo "keep    $name  ($branch merged, but the tree has uncommitted changes)"
    kept=$((kept + 1))
    return
  fi
  if reason="$(lock_reason "$path")"; then
    if ! stale_harness_lock "$path" "$reason"; then
      echo "keep    $name  ($branch merged, clean, but locked: ${reason:-no reason given})"
      echo "        once its agent has returned: git worktree unlock $path — then prune again"
      kept=$((kept + 1))
      return
    fi
    if [ "$dry_run" = 1 ]; then
      echo "would unlock  $name  (stale harness lock: pid $lock_pid is gone)"
    else
      echo "unlock  $name  (stale harness lock: pid $lock_pid is gone)"
      if ! git worktree unlock "$path"; then
        echo "        kept instead: git worktree unlock failed"
        kept=$((kept + 1))
        return
      fi
    fi
  fi

  if [ "$dry_run" = 1 ]; then
    echo "would remove  $name  ($branch merged, clean)"
    drop_databases "$path" --dry-run ||
      echo "        db:drop-worktree failed (exit $drop_status) — a real run would keep it"
    removed=$((removed + 1))
    return
  fi

  echo "remove  $name  ($branch merged, clean)"
  # First, while the worktree's back/.env still names its own database.
  if ! drop_databases "$path"; then
    echo "        kept instead: db:drop-worktree failed (exit $drop_status) — the next prune retries"
    kept=$((kept + 1))
    return
  fi
  if [ -f "$path/docker-compose.yml" ]; then
    docker compose --project-directory "$path" -f "$path/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  # `docker run` Postgres containers named after the worktree (kumite-task<N>-db,
  # task-<N>-<slug>-db, review-<PR>-db) — only ones whose name starts with it.
  ids="$(docker ps -aq --filter "name=^${name}" 2>/dev/null || true)"
  [ -n "$ids" ] && docker rm -f -v $ids >/dev/null 2>&1 || true
  # A remove that fails (a lock taken meanwhile, a busy file) must not count as
  # removed, nor take the branch the worktree still has checked out.
  if ! err="$(git worktree remove --force "$path" 2>&1)"; then
    printf '%s\n' "$err" | sed 's/^/        /'
    echo "        kept instead: git worktree remove failed (its databases were already dropped)"
    kept=$((kept + 1))
    return
  fi
  git branch -D "$branch" >/dev/null || echo "        could not delete the local branch $branch"
  removed=$((removed + 1))
}

removed=0
kept=0
remote_deleted=0
while IFS= read -r line; do
  path="${line#worktree }"
  [ "$path" = "$main" ] && continue
  merged=0
  prune_tree "$path"
  [ "$merged" = 1 ] && delete_remote "$branch"
done < <(git worktree list --porcelain | grep '^worktree ')

git worktree prune
if [ "$dry_run" = 1 ]; then
  echo "worktree-prune: $removed would be removed, $kept kept, $remote_deleted remote branches would be deleted (dry run)"
else
  echo "worktree-prune: $removed removed, $kept kept, $remote_deleted remote branches deleted"
fi

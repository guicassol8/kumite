#!/usr/bin/env bash
# Smoke test for scripts/worktree-prune.sh's lock and remote-branch steps
# (#465). The database step stays in scripts/worktree-env-smoke.sh, cases (q)
# and (r).
#
# It builds a throwaway repository in a temp dir with the working copy of
# worktree-prune.sh and the repository's own .gitignore, a bare `origin` next
# to it, and one linked worktree per case, each on its own branch with a
# commit pushed to origin. develop then moves past them all with a commit of
# its own, as a squash-merge does — so "merged" comes from the stub `gh`,
# except for the branches merged into develop for real. Stubs on PATH:
#   - pnpm   records every `db:drop-worktree <path>` (and whether back/.env
#            was still there);
#   - docker only records;
#   - gh     answers `pr list --head <b>` with the file $SMOKE_GH/<b, / -> _>
#            (lines `<number> <headRefOid>`, as the script's --jq prints them),
#            nothing without one, and fails when $SMOKE_GH_FAIL is <b>;
#   - git    delegates to the real git, except a `worktree remove` whose path
#            contains $SMOKE_GIT_REMOVE_FAIL, which fails (no chmod trick, so
#            it holds as root too, in cloud sessions).
# Nothing outside the temp dir is touched: no network, no Postgres, no Docker.
#
# Usage: bash scripts/worktree-prune-smoke.sh
set -uo pipefail

for tool in git awk; do
  command -v "$tool" >/dev/null || {
    echo "worktree-prune-smoke: '$tool' is required" >&2
    exit 2
  }
done
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "worktree-prune-smoke: not inside a git repository" >&2
  exit 2
}
real_git="$(command -v git)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

main="$tmp/main"
origin="$tmp/origin.git"
wt="$tmp/wt"
mkdir -p "$tmp/bin" "$tmp/gh" "$wt"

cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *--dry-run*) ;;
  *db:drop-worktree*)
    for arg in "$@"; do
      case "$arg" in /*) [ -f "$arg/back/.env" ] && env=yes || env=no; echo "drop $(basename "$arg") env=$env" >>"$SMOKE_LOG.drops" ;; esac
    done
    ;;
esac
exit 0
STUB
cat >"$tmp/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$SMOKE_LOG.docker"
exit 0
STUB
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$SMOKE_LOG.gh"
head=""
prev=""
for arg in "$@"; do
  [ "$prev" = --head ] && head="$arg"
  prev="$arg"
done
if [ -n "${SMOKE_GH_FAIL:-}" ] && [ "$head" = "$SMOKE_GH_FAIL" ]; then
  echo "smoke: stubbed gh failure" >&2
  exit 1
fi
file="$SMOKE_GH/${head//\//_}"
[ -f "$file" ] && cat "$file"
exit 0
STUB
cat >"$tmp/bin/git" <<STUB
#!/usr/bin/env bash
if [ "\${1:-}" = worktree ] && [ "\${2:-}" = remove ] && [ -n "\${SMOKE_GIT_REMOVE_FAIL:-}" ] &&
  [[ "\$*" == *"\$SMOKE_GIT_REMOVE_FAIL"* ]]; then
  echo "fatal: smoke: stubbed failure of 'git \$*'" >&2
  exit 128
fi
exec "$real_git" "\$@"
STUB
chmod +x "$tmp/bin/"*

g() { git -C "$main" -c user.name=smoke -c user.email=smoke@example.invalid -c commit.gpgsign=false "$@"; }
gw() { # gw <dir> <git args...>: git in that worktree, with an identity
  local dir="$1"
  shift
  git -C "$wt/$dir" -c user.name=smoke -c user.email=smoke@example.invalid -c commit.gpgsign=false "$@"
}

git init -q --bare -b develop "$origin" || exit 1
git init -q -b develop "$main" || exit 1
mkdir -p "$main/scripts" "$main/back"
cp "$repo/scripts/worktree-prune.sh" "$main/scripts/"
cp "$repo/.gitignore" "$main/.gitignore"
: >"$main/back/.gitkeep"
g add -A && g commit -qm init || exit 1
g remote add origin "$origin"
g push -q origin develop || exit 1

# add_case <dir> <branch>: a worktree on a new branch with one commit of its
# own, pushed to origin, and a back/.env (ignored) as worktree:env leaves.
add_case() {
  g worktree add -q -b "$2" "$wt/$1" 2>/dev/null || return 1
  echo "$1" >"$wt/$1/$1.txt"
  gw "$1" add "$1.txt" && gw "$1" commit -qm "$1" || return 1
  gw "$1" push -q origin "$2" || return 1
  echo "DATABASE_URL=postgres://x@localhost:5433/kumite_$1" >"$wt/$1/back/.env"
}
# merged_pr <branch> <number> [<sha>]: the stub gh reports that PR as MERGED,
# its head at <sha> (default: the branch's current commit).
merged_pr() { echo "$2 ${3:-$(g rev-parse "$1")}" >"$tmp/gh/${1//\//_}"; }
# lock <dir> <reason>
lock() { g worktree lock --reason "$2" "$wt/$1"; }
locked() { git -C "$main" worktree list --porcelain | grep -A5 -x "worktree $wt/$1" | grep -q '^locked'; }
remote_has() { git -C "$origin" show-ref -q --verify "refs/heads/$1"; }
local_has() { g show-ref -q --verify "refs/heads/$1"; }

dead_pid=2147483646 # above any pid_max: never a live process

# (a)/(k) locked by a live pid — this shell's — with its PR merged.
add_case agent-a11ce task/1-live && merged_pr task/1-live 1
lock agent-a11ce "claude agent agent-a11ce (pid $$ start 1)"
# (b) locked by a pid that is gone.
add_case agent-dead task/2-dead && merged_pr task/2-dead 2
lock agent-dead "claude agent agent-dead (pid $dead_pid start 1)"
# (c) a lock in another format; (c') the harness format naming another dir.
add_case task-3-manual task/3-manual && merged_pr task/3-manual 3
lock task-3-manual "manual hold"
add_case agent-beef task/4-other && merged_pr task/4-other 4
lock agent-beef "claude agent agent-cafe (pid $dead_pid start 1)"
# (d) a stale harness lock, but a dirty tree.
add_case agent-d1e7 task/5-dirty && merged_pr task/5-dirty 5
lock agent-d1e7 "claude agent agent-d1e7 (pid $dead_pid start 1)"
echo wip >"$wt/agent-d1e7/wip.txt"
# (e) `git worktree remove` fails.
add_case task-6-stuck task/6-stuck && merged_pr task/6-stuck 6
# (f) PR merged at the head origin has.
add_case task-7-done task/7-done && merged_pr task/7-done 7
# (g) a commit pushed to origin after the PR's head.
add_case task-8-later task/8-later && merged_pr task/8-later 8
echo more >"$wt/task-8-later/more.txt"
gw task-8-later add more.txt && gw task-8-later commit -qm more && gw task-8-later push -q origin task/8-later
# (h) merged into develop for real (an ancestor), but gh knows no merged PR.
add_case task-9-ff task/9-ff
# (i) merged into develop for real, and gh fails.
add_case task-10-ghfail task/10-ghfail
# (j) not a task/* branch.
add_case chore-x chore/x && merged_pr chore/x 11

g merge -q --no-edit task/9-ff task/10-ghfail >/dev/null || exit 1
echo squash >"$main/squash.txt" && g add squash.txt && g commit -qm "squash of the PRs"
g push -q origin develop || exit 1

failures=0
case_failed=0
begin() {
  case_name="$1"
  case_failed=0
}
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if ! "$@"; then
    echo "  FAIL $case_name: $what"
    case_failed=1
  fi
}
end() {
  if [ "$case_failed" = 0 ]; then
    echo "  ok   $case_name"
  else
    failures=$((failures + 1))
    printf '%s\n' "$out" | sed 's/^/       | /' | tail -n 40
  fi
}
says() { grep -qF -- "$1" <<<"$out"; }
not() { ! "$@"; }
# says_for <dir> <text>: the block of lines printed for that worktree (its own
# line and the indented ones under it) contains the text.
says_for() {
  awk -v d="$1" '
    /^[^ ]/ { cur = ($2 == d || $3 == d) }
    cur' <<<"$out" | grep -qF -- "$2"
}
dropped() { grep -qx "drop $1 env=yes" "$tmp/log.drops"; }
not_dropped() { not grep -q "^drop $1 " "$tmp/log.drops"; }
prune() {
  : >"$tmp/log.drops"
  : >"$tmp/log.gh"
  out="$(cd "$main" && env PATH="$tmp/bin:$PATH" SMOKE_LOG="$tmp/log" SMOKE_GH="$tmp/gh" \
    SMOKE_GH_FAIL=task/10-ghfail SMOKE_GIT_REMOVE_FAIL=task-6-stuck \
    bash scripts/worktree-prune.sh "$@" 2>&1)"
  rc=$?
}

echo "worktree-prune smoke: $repo/scripts/worktree-prune.sh"
echo

# --- dry run first: it must change nothing ------------------------------------
refs_before="$(git -C "$origin" show-ref)"
trees_before="$(git -C "$main" worktree list --porcelain)"

begin "(l) --dry-run says what it would do, and changes nothing"
prune --dry-run
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "would unlock the dead pid's tree" says_for agent-dead "would unlock"
expect "would delete origin/task/7-done" says_for task-7-done "would delete"
expect "the summary counts remote branches that would be deleted" says "remote branches would be deleted"
expect "origin untouched" [ "$(git -C "$origin" show-ref)" = "$refs_before" ]
expect "worktrees and locks untouched" [ "$(git -C "$main" worktree list --porcelain)" = "$trees_before" ]
expect "no database dropped" not grep -q . "$tmp/log.drops"
end

# --- the real run -------------------------------------------------------------
prune

begin "(a) locked by a live pid -> kept, nothing dropped"
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "keep ... locked" says_for agent-a11ce "but locked: claude agent agent-a11ce (pid $$ start 1)"
expect "says how to unlock it" says_for agent-a11ce "git worktree unlock $wt/agent-a11ce"
expect "the worktree stays" [ -d "$wt/agent-a11ce" ]
expect "still locked" locked agent-a11ce
expect "the local branch stays" local_has task/1-live
expect "its databases stay" not_dropped agent-a11ce
expect "not counted as removed" not says_for agent-a11ce "remove  agent-a11ce"
end

begin "(b) locked by a pid that is gone -> unlocked, then pruned"
expect "says unlock" says_for agent-dead "unlock"
expect "dropped with back/.env still there" dropped agent-dead
expect "the worktree is gone" [ ! -d "$wt/agent-dead" ]
expect "the local branch is gone" not local_has task/2-dead
end

begin "(c) a lock in another format -> kept"
expect "keep ... locked: manual hold" says_for task-3-manual "but locked: manual hold"
expect "the worktree stays" [ -d "$wt/task-3-manual" ]
expect "its databases stay" not_dropped task-3-manual
end

begin "(c') the harness format naming another directory -> kept"
expect "keep ... locked" says_for agent-beef "but locked: claude agent agent-cafe"
expect "the worktree stays" [ -d "$wt/agent-beef" ]
expect "still locked" locked agent-beef
expect "its databases stay" not_dropped agent-beef
end

begin "(d) a stale lock on a dirty tree -> kept for the dirt, lock untouched"
expect "kept for uncommitted changes" says_for agent-d1e7 "uncommitted changes"
expect "the worktree stays" [ -d "$wt/agent-d1e7" ]
expect "still locked" locked agent-d1e7
expect "its databases stay" not_dropped agent-d1e7
end

begin "(e) git worktree remove fails -> kept, never counted as removed"
expect "says kept instead" says_for task-6-stuck "kept instead: git worktree remove failed"
expect "the worktree stays" [ -d "$wt/task-6-stuck" ]
expect "the local branch stays" local_has task/6-stuck
expect "the summary counts 6 removed (dead, 7, 8, 9, 10, chore) and 5 kept (live, 3, beef, 5, 6)" \
  says "worktree-prune: 6 removed, 5 kept"
end

begin "(f) PR merged at origin's head -> origin's branch deleted"
expect "says deleted" says_for task-7-done "origin/task/7-done: deleted (PR #7)"
expect "gone from origin" not remote_has task/7-done
expect "the worktree is gone" [ ! -d "$wt/task-7-done" ]
end

begin "(g) origin got a commit after the PR's head -> origin's branch kept"
expect "says why" says_for task-8-later "origin/task/8-later: kept"
expect "still on origin" remote_has task/8-later
end

begin "(h) an ancestor of develop without a merged PR -> tree pruned, origin's branch kept"
expect "the worktree is gone" [ ! -d "$wt/task-9-ff" ]
expect "says why" says_for task-9-ff "origin/task/9-ff: kept"
expect "still on origin" remote_has task/9-ff
end

begin "(i) gh fails -> origin's branch kept, with the manual command"
expect "the worktree is gone" [ ! -d "$wt/task-10-ghfail" ]
expect "the manual command" says_for task-10-ghfail "git push origin --delete task/10-ghfail"
expect "still on origin" remote_has task/10-ghfail
end

begin "(j) a chore/* branch -> origin's branch kept"
expect "still on origin" remote_has chore/x
expect "never asked to delete it" not says "origin/chore/x: deleted"
end

begin "(k) the live-locked tree of (a), PR merged -> origin's branch deleted anyway"
expect "says deleted" says_for agent-a11ce "origin/task/1-live: deleted (PR #1)"
expect "gone from origin" not remote_has task/1-live
expect "the worktree still stays" [ -d "$wt/agent-a11ce" ]
end

begin "(m) the summary counts the remote branches deleted"
# deleted: 1-live, 2-dead, 3-manual, 4-other, 5-dirty, 6-stuck, 7-done = 7
expect "7 remote branches deleted" says "7 remote branches deleted"
end

echo
if [ "$failures" = 0 ]; then
  echo "worktree-prune smoke: all cases passed"
else
  echo "worktree-prune smoke: $failures case(s) failed"
  exit 1
fi

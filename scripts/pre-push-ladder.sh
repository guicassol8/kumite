#!/usr/bin/env bash
# pre-push (lefthook): the full gate ladder — typecheck, kata verify, tests —
# before anything reaches the remote (#399).
#
# Why here: the pre-commit stays fast and database-free (#288), the Stop hook
# only sees uncommitted work in the session's own tree, and subagents never
# fire it. A push is the one moment every agent and every mode goes through,
# right before the PR sees the code — so this is where the tests are gated.
#
# Scope guard: git hands the hook one line per pushed ref on stdin
# (`<local ref> <local sha> <remote ref> <remote sha>`). The ladder runs only
# when those commits change something under back/, front/, blocks/ or
# package.json — a docs-only push goes straight through. A new branch is
# compared with its merge-base on origin/develop. With no refs on stdin (none
# at all, or a terminal) the ladder always runs: that is the full ladder by
# hand, `bash scripts/pre-push-ladder.sh </dev/null`.
#
# Output: one line per step; on failure, the tail of that step's output and
# the path of the full log. The full run takes a few minutes, so an agent
# pushes with a long timeout (docs/workflow.md § Gate ladder).
# `bash scripts/pre-push-ladder-smoke.sh` proves the scope guard.
set -uo pipefail

root="$(git rev-parse --show-toplevel)" || exit 1
cd "$root" || exit 1

base_ref="${KUMITE_PRE_PUSH_BASE:-origin/develop}"
# Pathspecs, relative to the root: `package.json` is the root one only (a
# package's own package.json is already under back/, front/ or blocks/).
gated=(back front blocks package.json)

need=0
saw_ref=0
# A terminal is a person running this script by hand, not git: reading it
# would hang until Ctrl-D, so treat it as "no refs" and run the ladder. This
# only catches the script launched straight from a terminal: `lefthook run
# pre-push` hands its jobs a pipe (use_stdin), so run it as
# `lefthook run pre-push </dev/null` — otherwise it waits for Ctrl-D.
[ -t 0 ] && exec </dev/null
while read -r _local_ref local_sha _remote_ref remote_sha; do
  [ -n "${local_sha:-}" ] || continue
  saw_ref=1
  # Deleting a remote branch pushes nothing to check.
  [ -n "${local_sha//0/}" ] || continue
  if [ -n "${remote_sha//0/}" ] && git cat-file -e "${remote_sha}^{commit}" 2>/dev/null; then
    base="$remote_sha"
  else
    base="$(git merge-base "$local_sha" "$base_ref" 2>/dev/null)" || base=""
  fi
  # No usable base: check everything rather than skip silently.
  if [ -z "$base" ]; then
    need=1
    break
  fi
  # `git diff --quiet` exits 0 when the gated paths are untouched, 1 when they
  # changed and 128 on an error — anything but 0 runs the ladder. Not
  # `git diff --name-only | grep -q`: under pipefail, grep quitting at the
  # first match kills a long diff with SIGPIPE (141) and the push read as
  # "nothing gated" once the file list outgrew the pipe buffer (#399 review).
  if ! git diff --quiet "$base" "$local_sha" -- "${gated[@]}" 2>/dev/null; then
    need=1
    break
  fi
done
[ "$saw_ref" = 1 ] || need=1

if [ "$need" = 0 ]; then
  echo "pre-push: nothing under back/, front/, blocks/ or package.json — ladder skipped"
  exit 0
fi

# Git exports GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE… to its hooks, so that git
# commands in the hook find this repository — the scope guard above relies on
# it. The ladder must not inherit them: a test that runs git in another
# directory (worktreeSlug, #392) would see this repository instead, and the
# back suite would derive its database from the wrong tree (#407).
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_PREFIX

# Same database rule as the Stop hook: this tree's back/.env wins over an
# inherited DATABASE_URL (process.loadEnvFile() never overrides one already
# set). The back suite derives its own <db>_test[_<worktree dir>] from it
# (#392), so this never truncates the database an E2E or dev server is using.
if [ -f back/.env ]; then
  env_url="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}DATABASE_URL[[:space:]]*=[[:space:]]*//p' back/.env | tail -n 1 | tr -d '\r')"
  env_url="${env_url%\"}"
  env_url="${env_url#\"}"
  env_url="${env_url%\'}"
  env_url="${env_url#\'}"
  [ -n "$env_url" ] && export DATABASE_URL="$env_url"
fi

log="${TMPDIR:-/tmp}/kumite-pre-push-$(basename "$root").log"
: >"$log"

# step <label> <command...>
step() {
  local label="$1" started out
  shift
  started=$SECONDS
  if out="$("$@" 2>&1)"; then
    printf '%s\n' "$out" >>"$log"
    echo "pre-push: $label ok ($((SECONDS - started))s)"
    return 0
  fi
  printf '%s\n' "$out" >>"$log"
  echo "pre-push: $label FAILED — push refused. Fix it and push again (never --no-verify)." >&2
  tail -c 4000 <<<"$out" >&2
  echo "pre-push: full output in $log" >&2
  exit 1
}

step typecheck pnpm -r typecheck
step "kata verify" pnpm --filter @kumite/back exec kata verify --strict-coverage
step tests pnpm -r test

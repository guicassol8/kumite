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
# compared with its merge-base on origin/develop. With no stdin at all
# (`lefthook run pre-push` by hand) the ladder always runs.
#
# Output: one line per step; on failure, the tail of that step's output and
# the path of the full log. The full run takes a few minutes, so an agent
# pushes with a long timeout (docs/workflow.md § Gate ladder).
set -uo pipefail

root="$(git rev-parse --show-toplevel)" || exit 1
cd "$root" || exit 1

base_ref="${KUMITE_PRE_PUSH_BASE:-origin/develop}"
gated='^(back|front|blocks)/|^package\.json$'

need=0
saw_ref=0
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
  if [ -z "$base" ] || git diff --name-only "$base" "$local_sha" | grep -qE "$gated"; then
    need=1
    break
  fi
done
[ "$saw_ref" = 1 ] || need=1

if [ "$need" = 0 ]; then
  echo "pre-push: nothing under back/, front/, blocks/ or package.json — ladder skipped"
  exit 0
fi

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

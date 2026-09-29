#!/usr/bin/env bash
# Smoke test for the Claude Code hooks (.claude/hooks/{stop,post-tool-use}.sh)
# against a session that works in a git worktree (#286).
#
# Claude Code runs the hooks from $CLAUDE_PROJECT_DIR — the main checkout —
# even when the session works in a worktree, so the hooks must find the
# session's tree from the payload, not from their own path. This script
# reproduces that layout with two throwaway worktrees of HEAD:
#
#   .worktrees/hooks-smoke-<pid>-host     plays the main checkout: the hooks
#                                         run from here (BASH_SOURCE points
#                                         at it);
#   .worktrees/hooks-smoke-<pid>-session  plays the session's worktree.
#
# Both are removed on exit, error included. A stub `pnpm` on PATH records the
# directory it ran in and the DATABASE_URL it saw, so nothing real is built,
# verified or tested. Neither the caller's worktree nor the main checkout is
# touched.
#
# Hooks under test: HEAD's, plus scripts/claude-hooks.patch applied INSIDE
# the host worktree only when that patch exists and is not applied yet (the
# hook change travels as a patch the user applies by hand — #286).
# `--unpatched` skips the patch and tests HEAD's hooks as they are, to show
# the red. Uncommitted edits under .claude/hooks are never what runs, so the
# script refuses to start while there are any: commit, then smoke.
#
# Usage: bash scripts/claude-hooks-smoke.sh [--unpatched]
set -uo pipefail

unpatched=0
for arg in "$@"; do
  case "$arg" in
    --unpatched) unpatched=1 ;;
    --) ;;
    *)
      echo "claude-hooks-smoke: unknown argument '$arg'" >&2
      echo "usage: bash scripts/claude-hooks-smoke.sh [--unpatched]" >&2
      exit 2
      ;;
  esac
done

for tool in git jq; do
  command -v "$tool" >/dev/null || {
    echo "claude-hooks-smoke: '$tool' is required" >&2
    exit 2
  }
done

repo="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "claude-hooks-smoke: not inside a git repository" >&2
  exit 2
}
patch_file="$repo/scripts/claude-hooks.patch"
tag="hooks-smoke-$$"
host="$repo/.worktrees/$tag-host"
session="$repo/.worktrees/$tag-session"
tmp="$(mktemp -d)"

cleanup() {
  git -C "$repo" worktree remove --force "$host" >/dev/null 2>&1
  git -C "$repo" worktree remove --force "$session" >/dev/null 2>&1
  rm -rf "$host" "$session" "$tmp"
  git -C "$repo" worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

hooks_before="$(git -C "$repo" status --porcelain -- .claude/hooks)"

# The worktrees are cut from HEAD, so uncommitted hook edits (say, the patch
# just applied by hand) would silently not be what runs: commit them first.
if [ -n "$hooks_before" ]; then
  echo "claude-hooks-smoke: .claude/hooks has uncommitted changes, but this smoke tests HEAD's hooks — commit them first:" >&2
  echo "$hooks_before" >&2
  exit 2
fi

git -C "$repo" worktree add --detach -q "$host" HEAD || exit 1
git -C "$repo" worktree add --detach -q "$session" HEAD || exit 1

if [ "$unpatched" = 1 ]; then
  mode="unpatched: HEAD's hooks as they are"
elif [ ! -f "$patch_file" ]; then
  mode="HEAD's hooks (no scripts/claude-hooks.patch)"
elif git -C "$host" apply --reverse --check "$patch_file" >/dev/null 2>&1; then
  mode="HEAD's hooks (scripts/claude-hooks.patch already applied)"
elif git -C "$host" apply "$patch_file"; then
  mode="HEAD's hooks + scripts/claude-hooks.patch (applied in the host worktree only)"
else
  echo "claude-hooks-smoke: scripts/claude-hooks.patch does not apply to HEAD" >&2
  exit 1
fi
echo "claude-hooks-smoke: $mode"
echo "  host    = $host"
echo "  session = $session"
echo

# --- fixtures ----------------------------------------------------------------

mkdir -p "$tmp/bin" "$tmp/outside"
pnpm_log="$tmp/pnpm.log"
stop_log="$tmp/stop-hook.log"
cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
printf '%s\t%s\t%s\n' "$PWD" "${DATABASE_URL-<unset>}" "$*" >>"$SMOKE_PNPM_LOG"
case "$*" in
  *"kata verify --json"*) echo '{}' ;;
esac
# SMOKE_PNPM_FAIL=<substring>: the call whose arguments contain it fails.
if [ -n "${SMOKE_PNPM_FAIL:-}" ] && [[ "$*" == *"$SMOKE_PNPM_FAIL"* ]]; then
  echo "smoke: stubbed failure of 'pnpm $*'"
  exit 1
fi
exit 0
STUB
chmod +x "$tmp/bin/pnpm"

# The hooks only check that node_modules exists; the stub does the rest.
mkdir -p "$host/node_modules" "$session/node_modules"

dirty() { echo "export const smoke = 1;" >"$1/back/src/__hooks_smoke__.ts"; }
clean() { rm -f "$1/back/src/__hooks_smoke__.ts"; }

# run_hook <stop|post-tool-use> <cwd> <payload-json> [VAR=value ...]
# Sets: out (hook stdout), rc (exit code), calls (stub pnpm lines),
#       logged (lines the Stop hook appended to its log).
run_hook() {
  local hook="$1" dir="$2" payload="$3"
  shift 3
  : >"$pnpm_log"
  : >"$stop_log"
  out="$(cd "$dir" && env -u DATABASE_URL \
    PATH="$tmp/bin:$PATH" \
    CLAUDE_PROJECT_DIR="$host" \
    SMOKE_PNPM_LOG="$pnpm_log" \
    KUMITE_STOP_HOOK_LOG="$stop_log" \
    KUMITE_STOP_HOOK_STATE_DIR="$tmp/state" \
    "$@" bash "$host/.claude/hooks/$hook.sh" <<<"$payload" 2>/dev/null)"
  rc=$?
  calls="$(cat "$pnpm_log")"
  logged="$(cat "$stop_log")"
}

stop_payload() { jq -nc --arg cwd "$1" '{hook_event_name: "Stop", cwd: $cwd, stop_hook_active: false}'; }
# stop_retry <cwd> <session_id>: a Stop that follows a block in the same session.
stop_retry() {
  jq -nc --arg cwd "$1" --arg s "$2" \
    '{hook_event_name: "Stop", cwd: $cwd, session_id: $s, stop_hook_active: true}'
}
edit_payload() {
  jq -nc --arg cwd "$1" --arg f "$2" \
    '{hook_event_name: "PostToolUse", cwd: $cwd, tool_name: "Edit", tool_input: {file_path: $f}}'
}

# --- assertions --------------------------------------------------------------

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
  fi
}

no_pnpm() { [ -z "$calls" ]; }
some_pnpm() { [ -n "$calls" ]; }
all_pnpm_in() { # every stub call ran in $1
  [ -n "$calls" ] && ! cut -f1 <<<"$calls" | grep -qvxF "$1"
}
all_db_has() { [ -n "$calls" ] && ! cut -f2 <<<"$calls" | grep -qvF "$1"; }
call_in_with() { awk -F'\t' -v d="$1" -v a="$2" '$1 == d && index($3, a) { f = 1 } END { exit !f }' <<<"$calls"; }
no_call_with() { ! grep -qF "$1" <<<"$calls"; }
exit_zero() { [ "$rc" = 0 ]; }
silent() { [ -z "$out" ]; }
empty_json() { [ "$(jq -c . <<<"$out" 2>/dev/null)" = "{}" ]; }
blocks_with() { jq -e --arg s "$1" '.decision == "block" and (.reason | contains($s))' <<<"$out" >/dev/null 2>&1; }
warns_with() { jq -e --arg s "$1" '(.decision == null) and (.systemMessage | contains($s))' <<<"$out" >/dev/null 2>&1; }
not_blocked() { ! jq -e '.decision == "block"' <<<"$out" >/dev/null 2>&1; }
one_log_line() { [ -n "$logged" ] && [ "$(wc -l <<<"$logged")" = 1 ]; }
log_has() { grep -qF -- "$1" <<<"$logged"; }
log_no_secret() { ! grep -q 'postgres://' <<<"$logged"; }

# --- Stop --------------------------------------------------------------------

echo "Stop hook"

begin "(a) session worktree with back/ changes -> ladder runs in the session"
dirty "$session"
run_hook stop "$session" "$(stop_payload "$session")"
expect "exit 0" exit_zero
expect "not blocked" not_blocked
expect "pnpm called" some_pnpm
expect "every pnpm call ran in the session (got: $(cut -f1 <<<"$calls" | sort -u | tr '\n' ' '))" all_pnpm_in "$session"
expect "one log line" one_log_line
expect "log shows root=session" log_has "root=$session "
expect "log shows db=default" log_has "db=default"
expect "log shows decision=ladder" log_has "decision=ladder"
end

begin "(b) session back/.env DATABASE_URL wins over the inherited one"
printf 'PORT=3999\nDATABASE_URL="postgres://smoke:secret@localhost:5439/kumite"\n' >"$session/back/.env"
run_hook stop "$session" "$(stop_payload "$session")" DATABASE_URL=postgres://inherited:secret@localhost:5433/kumite
expect "pnpm called" some_pnpm
expect "every pnpm call saw :5439 (got: $(cut -f2 <<<"$calls" | sort -u | tr '\n' ' '))" all_db_has ":5439/"
expect "log shows db=back/.env" log_has "db=back/.env"
expect "log never carries the URL" log_no_secret
end
rm -f "$session/back/.env"

begin "(c) clean session worktree -> exit 0, no ladder"
clean "$session"
run_hook stop "$session" "$(stop_payload "$session")"
expect "exit 0" exit_zero
expect "silent" silent
expect "no pnpm" no_pnpm
expect "log shows root=session" log_has "root=$session "
expect "log shows decision=skip-clean" log_has "decision=skip-clean"
end

begin "(d) cwd outside any kumite tree -> falls back to the script's root"
run_hook stop "$tmp/outside" "$(stop_payload "$tmp/outside")"
expect "exit 0" exit_zero
expect "no pnpm (host is clean)" no_pnpm
expect "log shows root=host" log_has "root=$host "
expect "log shows decision=skip-clean" log_has "decision=skip-clean"
end

begin "(d2) session in the main checkout with back/ changes -> ladder in it"
dirty "$host"
run_hook stop "$host" "$(stop_payload "$host")" DATABASE_URL=postgres://inherited:secret@localhost:5433/kumite
expect "exit 0" exit_zero
expect "every pnpm call ran in the host" all_pnpm_in "$host"
expect "pnpm saw the inherited DATABASE_URL" all_db_has "inherited"
expect "log shows root=host" log_has "root=$host "
expect "log shows db=inherited" log_has "db=inherited"
expect "log never carries the URL" log_no_secret
end
clean "$host"

begin "(e) stop_hook_active with back/ changes -> the ladder still runs (#399)"
dirty "$session"
run_hook stop "$session" "$(stop_retry "$session" smoke-e)"
expect "exit 0" exit_zero
expect "not blocked" not_blocked
expect "pnpm called" some_pnpm
expect "one log line" one_log_line
expect "log shows active=true" log_has "active=true"
expect "log shows decision=ladder" log_has "decision=ladder"
end

begin "(e2) red ladder -> blocks 3 times in a row, then lets it stop with a warning"
for n in 1 2 3; do
  run_hook stop "$session" "$(stop_retry "$session" smoke-e2)" SMOKE_PNPM_FAIL="-r test"
  expect "stop $n blocks citing 'block $n of 3'" blocks_with "block $n of 3"
  expect "stop $n logs decision=blocked:test" log_has "decision=blocked:test"
done
run_hook stop "$session" "$(stop_retry "$session" smoke-e2)" SMOKE_PNPM_FAIL="-r test"
expect "4th stop is not blocked" not_blocked
expect "4th stop warns the ladder is not green" warns_with "NOT green"
expect "4th stop logs decision=released:test" log_has "decision=released:test"
run_hook stop "$session" "$(stop_retry "$session" smoke-e2)" SMOKE_PNPM_FAIL="-r test"
expect "after the release the count starts over" blocks_with "block 1 of 3"
end

begin "(e3) a green ladder resets the count"
run_hook stop "$session" "$(stop_retry "$session" smoke-e3)" SMOKE_PNPM_FAIL="-r test"
expect "first red stop is block 1" blocks_with "block 1 of 3"
run_hook stop "$session" "$(stop_retry "$session" smoke-e3)"
expect "green stop is not blocked" not_blocked
run_hook stop "$session" "$(stop_retry "$session" smoke-e3)" SMOKE_PNPM_FAIL="kata verify"
expect "next red stop is block 1 again" blocks_with "block 1 of 3"
expect "and names the failing step" blocks_with "kata verify failed"
end

begin "(e4) the count is per session"
run_hook stop "$session" "$(stop_retry "$session" smoke-e4a)" SMOKE_PNPM_FAIL="-r test"
run_hook stop "$session" "$(stop_retry "$session" smoke-e4a)" SMOKE_PNPM_FAIL="-r test"
expect "session A is on block 2" blocks_with "block 2 of 3"
run_hook stop "$session" "$(stop_retry "$session" smoke-e4b)" SMOKE_PNPM_FAIL="-r test"
expect "session B starts on block 1" blocks_with "block 1 of 3"
end

begin "(e5) a clean tree resets the count"
run_hook stop "$session" "$(stop_retry "$session" smoke-e5)" SMOKE_PNPM_FAIL="-r test"
clean "$session"
run_hook stop "$session" "$(stop_retry "$session" smoke-e5)"
expect "clean stop logs decision=skip-clean" log_has "decision=skip-clean"
dirty "$session"
run_hook stop "$session" "$(stop_retry "$session" smoke-e5)" SMOKE_PNPM_FAIL="-r test"
expect "next red stop is block 1 again" blocks_with "block 1 of 3"
end

begin "(f) session worktree without node_modules -> block asking for pnpm install"
mv "$session/node_modules" "$tmp/session-node_modules"
run_hook stop "$session" "$(stop_payload "$session")"
expect "exit 0" exit_zero
expect "blocks citing 'pnpm install'" blocks_with "pnpm install"
expect "no pnpm" no_pnpm
expect "log shows decision=blocked:install" log_has "decision=blocked:install"
end
mv "$tmp/session-node_modules" "$session/node_modules"
clean "$session"

# --- PostToolUse -------------------------------------------------------------

echo "PostToolUse hook"

begin "(g) edit in <session>/back -> kata verify runs in <session>/back"
run_hook post-tool-use "$session" "$(edit_payload "$session" "$session/back/src/config.ts")"
expect "exit 0" exit_zero
expect "kata verify ran in session/back" call_in_with "$session/back" "kata verify --json"
expect "biome ran in session" call_in_with "$session" "biome check"
expect "prints {}" empty_json
end

begin "(g2) edit in a session worktree without node_modules -> {} and no pnpm"
mv "$session/node_modules" "$tmp/session-node_modules"
run_hook post-tool-use "$session" "$(edit_payload "$session" "$session/back/src/config.ts")"
expect "prints {}" empty_json
expect "no pnpm" no_pnpm
end
mv "$tmp/session-node_modules" "$session/node_modules"

begin "(h) edit in <session>/front -> biome in the session, no kata verify"
run_hook post-tool-use "$session" "$(edit_payload "$session" "$session/front/src/main.tsx")"
expect "biome ran in session" call_in_with "$session" "biome check"
expect "no kata verify" no_call_with "kata verify"
expect "prints {}" empty_json
end

begin "(i) edit outside any kumite tree -> {} and no pnpm"
run_hook post-tool-use "$session" "$(edit_payload "$session" "$tmp/outside/x.ts")"
expect "prints {}" empty_json
expect "no pnpm" no_pnpm
end

begin "(j) edit in the main checkout -> same as before"
run_hook post-tool-use "$host" "$(edit_payload "$host" "$host/back/src/config.ts")"
expect "kata verify ran in host/back" call_in_with "$host/back" "kata verify --json"
expect "biome ran in host" call_in_with "$host" "biome check"
expect "prints {}" empty_json
end

# --- the caller's tree -------------------------------------------------------

begin "caller's .claude/hooks untouched"
hooks_after="$(git -C "$repo" status --porcelain -- .claude/hooks)"
expect "git status of .claude/hooks unchanged" [ "$hooks_before" = "$hooks_after" ]
end

echo
if [ "$failures" = 0 ]; then
  echo "claude-hooks-smoke: all cases passed"
  exit 0
fi
echo "claude-hooks-smoke: $failures case(s) failed"
exit 1

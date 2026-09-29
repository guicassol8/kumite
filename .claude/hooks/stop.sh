#!/usr/bin/env bash
# Stop hook: the full gate ladder. Blocks the agent from stopping while
# typecheck, kata verify or tests fail — up to KUMITE_STOP_HOOK_MAX_BLOCKS (3)
# times in a row, then lets it stop with a visible warning (#399).
#
# Scope guard: the ladder only runs when the working tree actually carries
# uncommitted changes under the code packages. A session that only talked,
# researched or planned touches nothing and stops instantly; work that is
# already committed is gated when it is pushed, by the pre-push ladder
# (lefthook, scripts/pre-push-ladder.sh — #399).
#
# Which tree (#286): Claude Code runs this script from $CLAUDE_PROJECT_DIR —
# always the main checkout, even when the session works in a worktree — so
# its own path says nothing about where the work is. The payload's `cwd` does:
# the ladder runs in the git toplevel of that directory, provided it is a
# worktree of this same repository; anything else falls back to the script's
# own root, which is exactly the old behavior in the main checkout. The
# ladder uses that tree's back/.env DATABASE_URL, and every run appends one
# line to /tmp/kumite-stop-hook.log (never the URL itself) — the first place
# to look when a Stop dies with exit 143.
#
# Retries (#399): Claude Code sets `stop_hook_active` once a Stop hook has
# blocked and the agent is trying to stop again. This hook used to exit 0
# right there, so it blocked exactly once and never checked the fix. Now the
# ladder runs every time; a counter per session and tree caps the blocks in a
# row at MAX_BLOCKS, after which the stop goes through with a systemMessage
# saying the ladder is still red. A green ladder or a clean tree resets it.
set -uo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="${KUMITE_STOP_HOOK_LOG:-/tmp/kumite-stop-hook.log}"
MAX_BLOCKS="${KUMITE_STOP_HOOK_MAX_BLOCKS:-3}"
STATE_DIR="${KUMITE_STOP_HOOK_STATE_DIR:-${TMPDIR:-/tmp}}"
START_PWD="$PWD"
payload="$(cat)"
payload_cwd="$(jq -r '.cwd // empty' <<<"$payload" 2>/dev/null)"
session_id="$(jq -r '.session_id // empty' <<<"$payload" 2>/dev/null)"
active="$(jq -r 'if .stop_hook_active == true then "true" else "false" end' <<<"$payload" 2>/dev/null)"

# resolve_root <dir>: the toplevel of <dir> when it is a worktree of the same
# repository as this script, else SCRIPT_ROOT.
resolve_root() {
  local top common own
  if [ -n "$1" ] && [ -d "$1" ] &&
    top="$(git -C "$1" rev-parse --show-toplevel 2>/dev/null)" &&
    common="$(git -C "$top" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" &&
    own="$(git -C "$SCRIPT_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" &&
    [ "$common" = "$own" ]; then
    echo "$top"
  else
    echo "$SCRIPT_ROOT"
  fi
}

ROOT="$(resolve_root "${payload_cwd:-$START_PWD}")"

# Blocks in a row, per session and tree.
counter="$STATE_DIR/kumite-stop-hook-$(printf '%s|%s' "${session_id:-no-session}" "$ROOT" | cksum | cut -d' ' -f1).count"

# The ladder must hit this tree's database: back/.env wins over an inherited
# DATABASE_URL, because process.loadEnvFile() never overrides one already set.
db_source=default
if [ -n "${DATABASE_URL:-}" ]; then
  db_source=inherited
fi
if [ -f "$ROOT/back/.env" ]; then
  env_url="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}DATABASE_URL[[:space:]]*=[[:space:]]*//p' "$ROOT/back/.env" | tail -n 1 | tr -d '\r')"
  env_url="${env_url%\"}"
  env_url="${env_url#\"}"
  env_url="${env_url%\'}"
  env_url="${env_url#\'}"
  if [ -n "$env_url" ]; then
    export DATABASE_URL="$env_url"
    db_source=back/.env
  fi
fi

# log <decision>: one line per run; a failed write never affects the hook.
log() {
  printf '%s pwd=%s payload_cwd=%s project_dir=%s root=%s db=%s active=%s decision=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$START_PWD" "${payload_cwd:-<none>}" \
    "${CLAUDE_PROJECT_DIR:-<unset>}" "$ROOT" "$db_source" "${active:-false}" "$1" \
    >>"$LOG" 2>/dev/null || true
}

cd "$ROOT" || exit 0

# No pending code changes -> nothing for the ladder to prove. Only the paths
# the gates actually compile, verify or test count; docs/ and kata-feedback/
# never gate. If git itself fails we fall through and run the ladder: the
# guard may skip work, never skip it silently on an error.
if changed="$(git status --porcelain -uall -- back front blocks package.json 2>/dev/null)"; then
  if [ -z "$changed" ]; then
    rm -f "$counter" 2>/dev/null
    log skip-clean
    exit 0
  fi
fi

# block <step> <reason>: block the stop, unless this session already got
# MAX_BLOCKS in a row for this tree — then let it stop, loudly.
block() {
  local n
  n="$(cat "$counter" 2>/dev/null)"
  case "$n" in '' | *[!0-9]*) n=0 ;; esac
  n=$((n + 1))
  if [ "$n" -gt "$MAX_BLOCKS" ]; then
    rm -f "$counter" 2>/dev/null
    log "released:$1"
    jq -n --arg msg "Stop hook: $1 still failing in $ROOT after $MAX_BLOCKS blocks in a row — letting the agent stop. The gate ladder is NOT green; the pre-push ladder will refuse the push until it is." \
      '{systemMessage: $msg}'
    exit 0
  fi
  mkdir -p "$STATE_DIR" 2>/dev/null
  echo "$n" >"$counter" 2>/dev/null || true
  log "blocked:$1"
  jq -n --arg reason "$2

(Stop hook: block $n of $MAX_BLOCKS in a row.)" '{decision: "block", reason: $reason}'
  exit 0
}

# A fresh worktree has no install: say so instead of a cryptic typecheck.
if [ ! -d "$ROOT/node_modules" ]; then
  block install "no node_modules in $ROOT — run \`pnpm install\` in $ROOT (node_modules are per-worktree), then stop again."
fi

out="$(pnpm -r typecheck 2>&1)" || block typecheck "typecheck failed:
$(tail -c 4000 <<<"$out")"

out="$(pnpm --filter @kumite/back exec kata verify --strict-coverage 2>&1)" || block verify "kata verify failed:
$(tail -c 4000 <<<"$out")"

out="$(pnpm -r test 2>&1)" || block test "tests failed:
$(tail -c 4000 <<<"$out")"

rm -f "$counter" 2>/dev/null
log ladder
exit 0

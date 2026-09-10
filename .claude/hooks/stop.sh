#!/usr/bin/env bash
# Stop hook: the full gate ladder. Blocks the agent from stopping while
# typecheck, kata verify or tests fail.
#
# Scope guard: the ladder only runs when the working tree actually carries
# uncommitted changes under the code packages. A session that only talked,
# researched or planned touches nothing and stops instantly; a session that
# already landed its work was gated by lefthook's pre-commit, so re-running
# the same three commands here is pure duplication.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payload="$(cat)"

# Avoid ping-pong: if we already blocked once this stop, let it through.
if jq -e '.stop_hook_active == true' <<<"$payload" >/dev/null 2>&1; then
  exit 0
fi

cd "$ROOT"

# No pending code changes -> nothing for the ladder to prove. Only the paths
# the gates actually compile, verify or test count; docs/ and kata-feedback/
# never gate. If git itself fails we fall through and run the ladder: the
# guard may skip work, never skip it silently on an error.
if changed="$(git status --porcelain -uall -- back front blocks package.json 2>/dev/null)"; then
  if [ -z "$changed" ]; then
    exit 0
  fi
fi

block() {
  jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
  exit 0
}

out="$(pnpm -r typecheck 2>&1)" || block "typecheck failed:
$(tail -c 4000 <<<"$out")"

out="$(pnpm --filter @kumite/back exec kata verify --strict-coverage 2>&1)" || block "kata verify failed:
$(tail -c 4000 <<<"$out")"

out="$(pnpm -r test 2>&1)" || block "tests failed:
$(tail -c 4000 <<<"$out")"

exit 0

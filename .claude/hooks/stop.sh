#!/usr/bin/env bash
# Stop hook: the full gate ladder. Blocks the agent from stopping while
# typecheck, kata verify or tests fail.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payload="$(cat)"

# Avoid ping-pong: if we already blocked once this stop, let it through.
if jq -e '.stop_hook_active == true' <<<"$payload" >/dev/null 2>&1; then
  exit 0
fi

cd "$ROOT"

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

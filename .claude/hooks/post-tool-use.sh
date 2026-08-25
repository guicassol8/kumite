#!/usr/bin/env bash
# PostToolUse (Write|Edit|MultiEdit): auto-format the edited file, then run
# kata verify when the edit touched back/. kata verify --json prints the hook
# JSON contract itself ({} when clean, {"decision":"block",...} on violations).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payload="$(cat)"
file="$(jq -r '.tool_input.file_path // empty' <<<"$payload" 2>/dev/null)"

if [ -z "$file" ]; then
  echo '{}'
  exit 0
fi

case "$file" in
  "$ROOT"/*) rel="${file#"$ROOT"/}" ;;
  *)
    echo '{}'
    exit 0
    ;;
esac

# 1. Auto-format silently — formatting never fails the hook.
(cd "$ROOT" && pnpm exec biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1) || true

# 2. Back edits → kata verify owns the hook output.
case "$rel" in
  back/*)
    cd "$ROOT/back" && exec pnpm exec kata verify --json
    ;;
esac

echo '{}'

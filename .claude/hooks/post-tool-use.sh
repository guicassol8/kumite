#!/usr/bin/env bash
# PostToolUse (Write|Edit|MultiEdit): auto-format the edited file, then run
# kata verify when the edit touched back/. kata verify --json prints the hook
# JSON contract itself ({} when clean, {"decision":"block",...} on violations).
#
# Which tree (#286): Claude Code runs this script from the main checkout even
# when the session edits a worktree, so the tree is the one holding the edited
# file — the git toplevel of its directory, provided it is a worktree of this
# same repository; otherwise the script's own root (the old behavior).
set -uo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payload="$(cat)"
file="$(jq -r '.tool_input.file_path // empty' <<<"$payload" 2>/dev/null)"

if [ -z "$file" ]; then
  echo '{}'
  exit 0
fi

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

ROOT="$(resolve_root "$(dirname "$file")")"

case "$file" in
  "$ROOT"/*) rel="${file#"$ROOT"/}" ;;
  *)
    echo '{}'
    exit 0
    ;;
esac

# A worktree without its install has nothing to run; the Stop hook says so.
if [ ! -d "$ROOT/node_modules" ]; then
  echo '{}'
  exit 0
fi

# 1. Auto-format silently — formatting never fails the hook.
(cd "$ROOT" && pnpm exec biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1) || true

# 2. Back edits → kata verify owns the hook output.
case "$rel" in
  back/*)
    cd "$ROOT/back" && exec pnpm exec kata verify --json
    ;;
esac

echo '{}'

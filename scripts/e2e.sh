#!/usr/bin/env bash
# pnpm e2e (#404): the Playwright suite with this tree's own environment and a
# slot in a machine-wide semaphore.
#
# Environment: this tree's back/.env is exported over the shell's (a shell
# that exports PORT, DATABASE_URL or APP_BASE_URL would otherwise point the
# back Playwright starts at another tree's database), plus FRONT_PORT,
# VITE_API_URL and a BACK_NOTIFICATIONS_LOG, so the organizer and real-OTP
# specs run instead of skipping. In a linked worktree, `pnpm worktree:env`
# writes that back/.env first. The exports come from `worktree-env.sh
# --print`, which refuses a back/.env that worktree:env wrote for another tree
# (a copy, #413) or before #413 (no tree in its marker) — so the run stops
# before Playwright reuses that tree's servers and seeds its database. A
# back/.env with no marker at all only gets the warning below. Its SES_* are
# exported too, but the back Playwright starts blanks them
# (front/playwright.config.ts, #416): the E2E never sends email and the OTP
# always lands in the BACK_NOTIFICATIONS_LOG. A back already listening on PORT
# is reused as it is, SES included.
#
# Semaphore: every full E2E holds Chromium workers, a Vite and a back —
# gigabytes of RAM. KUMITE_E2E_SLOTS runs may go at once (default: one per
# 5 GB of the machine's memory, at least one); the next one waits for a free
# slot. The slots are flock(1) locks in $TMPDIR, held until Playwright exits.
#
# Usage: pnpm e2e [playwright args]      (CI=1 pnpm e2e for the CI settings)
set -uo pipefail

root="$(git rev-parse --show-toplevel)" || exit 1
cd "$root" || exit 1
main="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"

if [ ! -f back/.env ]; then
  if [ "$root" = "$main" ]; then
    echo "e2e: no back/.env — copy back/.env.example and fill it in" >&2
  else
    echo "e2e: no back/.env in this worktree — run \`pnpm worktree:env\` first" >&2
  fi
  exit 1
fi
if [ "$root" != "$main" ] && ! grep -qF '# worktree:env (#404)' back/.env; then
  echo "e2e: warning — this worktree's back/.env was not written by \`pnpm worktree:env\`;" >&2
  echo "     it may share its database with the main checkout" >&2
fi

# Captured first: `eval "$(…)"` succeeds even when --print failed.
envs="$(bash scripts/worktree-env.sh --print)" || exit 1
eval "$envs"
export BACK_NOTIFICATIONS_LOG="${BACK_NOTIFICATIONS_LOG:-${TMPDIR:-/tmp}/kumite-e2e-back-$(basename "$root").log}"

slots="${KUMITE_E2E_SLOTS:-}"
if [ -z "$slots" ]; then
  mem_kb="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo 2>/dev/null)"
  slots=$((${mem_kb:-0} / (5 * 1024 * 1024)))
fi
[ "$slots" -ge 1 ] 2>/dev/null || slots=1
lockdir="${KUMITE_E2E_LOCK_DIR:-${TMPDIR:-/tmp}}"

if command -v flock >/dev/null; then
  waited=0
  slot=0
  while [ "$slot" = 0 ]; do
    for i in $(seq 1 "$slots"); do
      exec 9>"$lockdir/kumite-e2e-slot-$i.lock"
      if flock -n 9; then
        slot=$i
        break
      fi
      exec 9>&-
    done
    if [ "$slot" = 0 ]; then
      [ "$waited" = 1 ] || echo "e2e: all $slots E2E slot(s) busy — waiting for one…"
      waited=1
      sleep "${KUMITE_E2E_POLL_SECONDS:-5}"
    fi
  done
  echo "e2e: slot $slot of $slots — $(basename "$root"): back :$PORT, front :$FRONT_PORT"
else
  echo "e2e: flock not found — running without the E2E semaphore" >&2
fi

# fd 9 (the slot's lock) stays open in pnpm, which exits when Playwright does;
# pnpm's children do not inherit it, so a leftover webServer never holds a slot.
exec pnpm --filter @kumite/front e2e "$@"

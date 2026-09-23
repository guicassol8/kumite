#!/usr/bin/env bash
# SessionStart hook (#333): prepares a Claude Code cloud session so the gate
# ladder and the full E2E suite run with no manual step — Docker + Postgres,
# dependencies, both .env files, migrations and the organizer seed.
#
# Cloud only: a local machine keeps whatever setup its owner already has.
# Idempotent: an existing .env is never touched, and migrate/seed are no-ops
# on a database that already has them. A failing step is reported and the
# rest still run — the session always starts, the report says what's missing.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Same throwaway organizer as CI (.github/workflows/ci.yml): it only ever
# exists in this container's local database. Values already set in the
# cloud environment win.
export ORGANIZER_EMAIL="${ORGANIZER_EMAIL:-organizer@ci.local}"
export ORGANIZER_PASSWORD="${ORGANIZER_PASSWORD:-kumite-ci-only}"
# reset-password.spec.ts reads the OTP from here; playwright.config.ts tees
# the back's stdout into it whenever the variable is set.
export BACK_NOTIFICATIONS_LOG="${BACK_NOTIFICATIONS_LOG:-/tmp/kumite-back-notifications.log}"

failed=()

step() {
  local name="$1"
  shift
  local out
  if out="$("$@" 2>&1)"; then
    echo "session-start: $name ok"
  else
    failed+=("$name")
    echo "session-start: $name FAILED:"
    tail -n 20 <<<"$out"
  fi
}

start_docker() {
  docker info >/dev/null 2>&1 && return 0
  (dockerd >/tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "dockerd did not answer in 30s — see /tmp/dockerd.log"
  return 1
}

env_files() {
  if [ ! -f back/.env ]; then
    cp back/.env.example back/.env
    local secret
    secret="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=$secret/" back/.env
  fi
  [ -f front/.env ] || cp front/.env.example front/.env
}

step "docker" start_docker
step "docker compose" docker compose up -d --wait
step "pnpm install" pnpm install --frozen-lockfile
step ".env files" env_files
step "db:migrate" pnpm --filter @kumite/back db:migrate
step "db:seed" pnpm --filter @kumite/back db:seed

# Task work happens in worktrees, which have no .env of their own. JWT_SECRET
# is the one value the back can't default, so it goes into the session's
# environment too — process.loadEnvFile() never overrides a set variable.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  jwt_secret="${JWT_SECRET:-$(sed -n 's/^JWT_SECRET=//p' back/.env 2>/dev/null)}"
  {
    echo "export ORGANIZER_EMAIL='$ORGANIZER_EMAIL'"
    echo "export ORGANIZER_PASSWORD='$ORGANIZER_PASSWORD'"
    echo "export BACK_NOTIFICATIONS_LOG='$BACK_NOTIFICATIONS_LOG'"
    [ -n "$jwt_secret" ] && echo "export JWT_SECRET='$jwt_secret'"
  } >>"$CLAUDE_ENV_FILE"
fi

if [ "${#failed[@]}" -gt 0 ]; then
  echo "session-start: failed steps: ${failed[*]} — fix them before running the gates or the E2E."
fi
exit 0

#!/usr/bin/env bash
# pnpm worktree:env (#404): gives a linked worktree its own Postgres database
# and ports, so its E2E, hurl and dev server never touch another tree's — the
# five manual steps docs/workflow.md § Worktrees used to list.
#
# Inside a linked worktree (never the main checkout), it:
#   - names the database after the task: <main db>_task<N> on a task/<N>-…
#     branch, <main db>_<dir> otherwise (review-405 -> kumite_review405), on
#     the main checkout's Postgres server and credentials;
#   - picks a back port 3xxx and a front port 5xxx from the same number,
#     skipping any port that is listening or already named by another tree's
#     back/.env;
#   - writes back/.env — the main checkout's back/.env (secrets, organizer)
#     with DATABASE_URL, PORT, APP_BASE_URL and FRONT_PORT replaced — and
#     front/.env (VITE_API_URL);
#   - runs db:create, db:migrate and db:seed the first time, db:migrate on
#     later runs, db:reset with --reset (a clean seed before a full E2E).
# Re-running keeps the database and ports it chose the first time.
#
# The shell's own PORT, DATABASE_URL and APP_BASE_URL never leak in: every
# command runs with this tree's back/.env exported over them.
#
# Usage: pnpm worktree:env [--reset]
#        eval "$(bash scripts/worktree-env.sh --print)"   # this tree's env, in your shell
set -uo pipefail

mode=setup
reset=0
for arg in "$@"; do
  case "$arg" in
    --reset) reset=1 ;;
    --print) mode=print ;;
    --) ;;
    *)
      echo "worktree-env: unknown argument '$arg'" >&2
      echo "usage: pnpm worktree:env [--reset] | bash scripts/worktree-env.sh --print" >&2
      exit 2
      ;;
  esac
done

root="$(git rev-parse --show-toplevel)" || exit 1
cd "$root" || exit 1
main="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
here="$(basename "$root")"
marker='# worktree:env (#404)'

# exports: this tree's back/.env as `export` lines, plus what the E2E needs.
exports() {
  node scripts/env-exports.mjs back/.env || return 1
  local port front
  port="$(sed -n 's/^PORT=//p' back/.env | tail -n 1)"
  front="$(sed -n 's/^FRONT_PORT=//p' back/.env | tail -n 1)"
  echo "export FRONT_PORT='${front:-5173}'"
  echo "export VITE_API_URL='http://localhost:${port:-3000}'"
}

if [ "$mode" = print ]; then
  if [ ! -f back/.env ]; then
    echo "worktree-env: no back/.env in $root — run \`pnpm worktree:env\` first" >&2
    exit 1
  fi
  echo "unset PORT DATABASE_URL APP_BASE_URL FRONT_PORT VITE_API_URL"
  exports
  exit
fi

if [ "$root" = "$main" ]; then
  echo "worktree-env: this is the main checkout — its back/.env stays as it is." >&2
  echo "Run it inside a linked worktree (.worktrees/…, .claude/worktrees/…)." >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "worktree-env: run \`pnpm install\` in $root first (node_modules are per-worktree)" >&2
  exit 1
fi

# set_var <file> <key> <value>: replaces KEY=… (first one wins) or appends it.
set_var() {
  local tmp
  tmp="$(mktemp)" || return 1
  K="$2" V="$3" awk '
    BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"]; done = 0 }
    $0 ~ "^[[:space:]]*(export[[:space:]]+)?" k "[[:space:]]*=" {
      if (!done) print k "=" v
      done = 1
      next
    }
    { print }
    END { if (!done) print k "=" v }
  ' "$1" >"$tmp" && mv "$tmp" "$1"
}

# get_var <file> <key>: the parsed value (quotes and comments handled).
get_var() {
  [ -f "$1" ] || return 0
  node -e '
    const { parseEnv } = require("node:util")
    const env = parseEnv(require("node:fs").readFileSync(process.argv[1], "utf8"))
    process.stdout.write(env[process.argv[2]] ?? "")
  ' "$1" "$2"
}

listening() {
  if command -v ss >/dev/null; then
    [ -n "$(ss -Hltn "sport = :$1" 2>/dev/null)" ]
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

first_run=1
if [ -f back/.env ] && grep -qF "$marker" back/.env; then
  first_run=0
  db_url="$(get_var back/.env DATABASE_URL)"
  port="$(get_var back/.env PORT)"
  front="$(get_var back/.env FRONT_PORT)"
  echo "worktree-env: keeping this tree's database and ports (back/.env from an earlier run)"
else
  # --- the database name -----------------------------------------------------
  main_url="$(get_var "$main/back/.env" DATABASE_URL)"
  main_url="${main_url:-postgres://kumite:kumite@localhost:5433/kumite}"
  branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [[ "$branch" =~ ^task/([0-9]+)- ]]; then
    id="task${BASH_REMATCH[1]}"
  elif [[ "$here" =~ ^([a-z]+)-([0-9]+)(-|$) ]]; then
    id="${BASH_REMATCH[1]}${BASH_REMATCH[2]}"
  else
    id="$(tr 'A-Z' 'a-z' <<<"$here" | tr -c 'a-z0-9\n' '_')"
  fi
  db_url="$(node -e '
    const url = new URL(process.argv[1])
    const base = decodeURIComponent(url.pathname.slice(1))
    const name = `${base}_${process.argv[2]}`.slice(0, 63)
    url.pathname = `/${encodeURIComponent(name)}`
    process.stdout.write(url.toString())
  ' "$main_url" "$id")"

  # --- the ports ---------------------------------------------------------------
  num="$(grep -oE '[0-9]+' <<<"$id" | tail -n 1)"
  [ -n "$num" ] || num="$(($(cksum <<<"$id" | cut -d' ' -f1) % 1000))"
  num=$((10#$num % 1000))
  taken=" 3000 5173 "
  while IFS= read -r line; do
    tree="${line#worktree }"
    [ "$tree" = "$root" ] && continue
    for key in PORT FRONT_PORT; do
      value="$(get_var "$tree/back/.env" "$key")"
      [ -n "$value" ] && taken="$taken$value "
    done
  done < <(git worktree list --porcelain | grep '^worktree ')
  pick() { # pick <first port>
    local p="$1"
    while [[ "$taken" == *" $p "* ]] || listening "$p"; do p=$((p + 1)); done
    taken="$taken$p "
    echo "$p"
  }
  port="$(pick $((3000 + num)))"
  front="$(pick $((5000 + num)))"

  # --- the .env files ----------------------------------------------------------
  [ -f back/.env ] && cp back/.env back/.env.bak && echo "worktree-env: the old back/.env is in back/.env.bak"
  if [ -f "$main/back/.env" ]; then
    cp "$main/back/.env" back/.env
  else
    cp back/.env.example back/.env
  fi
  { echo "$marker: this worktree's own database and ports — re-run"; echo "# pnpm worktree:env instead of editing them by hand."; cat back/.env; } >back/.env.tmp &&
    mv back/.env.tmp back/.env
  set_var back/.env DATABASE_URL "$db_url"
  set_var back/.env PORT "$port"
  set_var back/.env APP_BASE_URL "http://localhost:$front"
  set_var back/.env FRONT_PORT "$front"
fi

if [ -f front/.env ]; then
  set_var front/.env VITE_API_URL "http://localhost:$port"
else
  printf '%s\nVITE_API_URL=http://localhost:%s\n' "$marker" "$port" >front/.env
fi

# --- the database ----------------------------------------------------------------
unset PORT DATABASE_URL APP_BASE_URL FRONT_PORT VITE_API_URL
eval "$(exports)" || exit 1

db() { # db <script>: quiet on success, the tail on failure
  local out
  if ! out="$(pnpm --filter @kumite/back "$1" 2>&1)"; then
    echo "worktree-env: $1 failed:" >&2
    tail -n 20 <<<"$out" >&2
    exit 1
  fi
  echo "worktree-env: $1 ok"
}
db db:create
db db:migrate
if [ "$reset" = 1 ]; then
  db db:reset
elif [ "$first_run" = 1 ]; then
  db db:seed
fi

name="$(node -e 'process.stdout.write(decodeURIComponent(new URL(process.argv[1]).pathname.slice(1)))' "$db_url")"
echo
echo "worktree-env: $here → database $name, back :$port, front :$front"
echo "  E2E:           pnpm e2e [playwright args]"
echo "  this env here: eval \"\$(bash scripts/worktree-env.sh --print)\""

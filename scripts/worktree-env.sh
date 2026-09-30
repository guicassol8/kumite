#!/usr/bin/env bash
# pnpm worktree:env (#404): gives a linked worktree its own Postgres database
# and ports, so its E2E, hurl and dev server never touch another tree's — the
# five manual steps docs/workflow.md § Worktrees used to list.
#
# Inside a linked worktree (never the main checkout), it:
#   - names the database after the task: <main db>_task<N> on a task/<N>-…
#     branch, <main db>_<dir> otherwise (review-405 -> kumite_review405), on
#     the main checkout's Postgres server and credentials — with a _2, _3…
#     suffix when another tree's back/.env already names it (two branches of
#     one issue);
#   - picks a back port 3xxx and a front port 5xxx from the same number,
#     skipping any port that is listening or already named by another tree's
#     back/.env;
#   - writes back/.env — the main checkout's back/.env (secrets, organizer)
#     with DATABASE_URL, PORT, APP_BASE_URL and FRONT_PORT replaced — and
#     front/.env (VITE_API_URL);
#   - runs db:create, db:migrate and db:seed the first time, db:migrate on
#     later runs, db:reset with --reset (a clean seed before a full E2E) —
#     and db:seed again whenever the last seed did not complete: a run cut
#     short (a failed migrate or seed, Ctrl-C) or a database created anew.
#     back/.env carries a `# worktree:env: seeded` line only while the last
#     seed or reset has completed.
# Re-running keeps the database and ports it chose the first time — as long
# as back/.env carries this tree's own marker line, `# worktree:env (#404)
# tree=<this tree's root>` (#413). A back/.env copied from another worktree,
# or written before #413 with no tree in its marker, is not this tree's: the
# run says whose it was, keeps it in back/.env.bak and starts over as a first
# run. Until then, --print (and pnpm e2e with it) refuses it.
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
# back/.env is this tree's only with this exact line (grep -x): as a substring,
# …/review's would match …/review-7's.
owner="$marker tree=$root"

# foreign: why back/.env is not this tree's although worktree:env wrote it —
# a copy from another tree, or the #404 marker that named no tree. Prints
# nothing when back/.env is this tree's, has no marker, or is missing.
foreign() {
  [ -f back/.env ] || return 0
  grep -qF "$marker" back/.env || return 0
  grep -qxF "$owner" back/.env && return 0
  local other
  other="$(awk -v p="$marker tree=" 'index($0, p) == 1 { print substr($0, length(p) + 1); exit }' back/.env)"
  if [ -n "$other" ]; then
    echo "back/.env was written by pnpm worktree:env for $other"
  else
    echo "back/.env was written by pnpm worktree:env before #413 (no tree in its marker)"
  fi
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

# exports: this tree's back/.env as `export` lines, plus what the E2E needs.
# The ports are parsed like every other value (a quoted PORT stays a number)
# and must be plain numbers: they go into eval'd output unquoted.
exports() {
  node scripts/env-exports.mjs back/.env || return 1
  local port front
  port="$(get_var back/.env PORT)"
  front="$(get_var back/.env FRONT_PORT)"
  port="${port:-3000}"
  front="${front:-5173}"
  if [[ ! "$port" =~ ^[0-9]+$ || ! "$front" =~ ^[0-9]+$ ]]; then
    echo "worktree-env: PORT and FRONT_PORT in back/.env must be plain numbers" >&2
    return 1
  fi
  echo "export PORT=$port"
  echo "export FRONT_PORT=$front"
  echo "export VITE_API_URL=http://localhost:$port"
}

if [ "$mode" = print ]; then
  if [ ! -f back/.env ]; then
    echo "worktree-env: no back/.env in $root — run \`pnpm worktree:env\` first" >&2
    exit 1
  fi
  # Another tree's back/.env would point this tree's E2E at that tree's ports —
  # and Playwright reuses whatever server is up there (#413).
  why="$(foreign)"
  if [ "$root" != "$main" ] && [ -n "$why" ]; then
    echo "worktree-env: $why, not for this tree ($root) —" >&2
    echo "  run \`pnpm worktree:env\` here first: it gives this tree its own database and ports" >&2
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

listening() {
  if command -v ss >/dev/null; then
    [ -n "$(ss -Hltn "sport = :$1" 2>/dev/null)" ]
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

if [ -f back/.env ] && grep -qxF "$owner" back/.env; then
  db_url="$(get_var back/.env DATABASE_URL)"
  port="$(get_var back/.env PORT)"
  front="$(get_var back/.env FRONT_PORT)"
  echo "worktree-env: keeping this tree's database and ports (back/.env from an earlier run)"
else
  why="$(foreign)"
  [ -z "$why" ] || echo "worktree-env: $why — giving this tree its own database and ports"
  # --- what the other trees already use ------------------------------------
  taken=" 3000 5173 "
  taken_dbs=()
  while IFS= read -r line; do
    tree="${line#worktree }"
    [ "$tree" = "$root" ] && continue
    for key in PORT FRONT_PORT; do
      value="$(get_var "$tree/back/.env" "$key")"
      [ -n "$value" ] && taken="$taken$value "
    done
    value="$(get_var "$tree/back/.env" DATABASE_URL)"
    [ -n "$value" ] && taken_dbs+=("$value")
  done < <(git worktree list --porcelain | grep '^worktree ')

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
  # Never a name another tree's back/.env uses, nor the main base or its _test.
  db_url="$(node -e '
    const [mainUrl, id, ...others] = process.argv.slice(1)
    const nameOf = (u) => { try { return decodeURIComponent(new URL(u).pathname.slice(1)) } catch { return "" } }
    const url = new URL(mainUrl)
    const base = nameOf(mainUrl)
    const taken = new Set([base, `${base}_test`, ...others.map(nameOf)])
    const stem = `${base}_${id}`
    let name = stem.slice(0, 63)
    for (let n = 2; taken.has(name); n++) name = `${stem.slice(0, 63 - `_${n}`.length)}_${n}`
    url.pathname = `/${encodeURIComponent(name)}`
    process.stdout.write(url.toString())
  ' "$main_url" "$id" ${taken_dbs[@]+"${taken_dbs[@]}"})" || exit 1

  # --- the ports ---------------------------------------------------------------
  num="$(grep -oE '[0-9]+' <<<"$id" | tail -n 1)"
  [ -n "$num" ] || num="$(($(cksum <<<"$id" | cut -d' ' -f1) % 1000))"
  num=$((10#$num % 1000))
  pick() { # pick <first port>: sets $picked, and marks it taken
    local p="$1"
    while [[ "$taken" == *" $p "* ]] || listening "$p"; do p=$((p + 1)); done
    taken="$taken$p "
    picked="$p"
  }
  pick $((3000 + num))
  port="$picked"
  pick $((5000 + num))
  front="$picked"

  # --- the .env files ----------------------------------------------------------
  [ -f back/.env ] && cp back/.env back/.env.bak && echo "worktree-env: the old back/.env is in back/.env.bak"
  if [ -f "$main/back/.env" ]; then
    cp "$main/back/.env" back/.env
  else
    cp back/.env.example back/.env
  fi
  {
    echo "$owner"
    echo "# This worktree's own database and ports — re-run"
    echo "# pnpm worktree:env instead of editing them by hand."
    cat back/.env
  } >back/.env.tmp &&
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
# Captured first: `eval "$(exports)"` would succeed on a failed exports.
envs="$(exports)" || exit 1
eval "$envs"

db() { # db <script>: quiet on success, the tail on failure; output in $db_out
  if ! db_out="$(pnpm --filter @kumite/back "$1" 2>&1)"; then
    echo "worktree-env: $1 failed:" >&2
    tail -n 20 <<<"$db_out" >&2
    exit 1
  fi
  echo "worktree-env: $1 ok"
}
# `seeded` is in back/.env only while the last seed (or reset) completed:
# removed before one starts, written back after it succeeds. So any run cut
# short past db:create — a failed migrate or seed, Ctrl-C — seeds next time.
seeded='# worktree:env: seeded'
unmark_seeded() {
  local tmp
  tmp="$(mktemp)" || exit 1
  grep -vxF "$seeded" back/.env >"$tmp"
  mv "$tmp" back/.env
}

db db:create
# A database created now is empty even when back/.env says seeded (it was
# dropped by hand), so it gets the seed too.
created=0
[[ "$db_out" == *'" created'* ]] && created=1
if [ "$reset" = 1 ] || [ "$created" = 1 ] || ! grep -qxF "$seeded" back/.env; then
  unmark_seeded
  db db:migrate
  if [ "$reset" = 1 ]; then db db:reset; else db db:seed; fi
  echo "$seeded" >>back/.env
else
  db db:migrate
fi

name="$(node -e 'process.stdout.write(decodeURIComponent(new URL(process.argv[1]).pathname.slice(1)))' "$db_url")"
echo
echo "worktree-env: $here → database $name, back :$port, front :$front"
echo "  E2E:           pnpm e2e [playwright args]"
echo "  this env here: eval \"\$(bash scripts/worktree-env.sh --print)\""

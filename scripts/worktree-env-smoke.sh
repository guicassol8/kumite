#!/usr/bin/env bash
# Smoke test for scripts/worktree-env.sh and scripts/e2e.sh (#404): the
# database and ports each worktree gets, and the E2E semaphore — plus
# scripts/worktree-prune.sh's database step (#395).
#
# It builds a throwaway repository in a temp dir with the working copy of the
# scripts (and env-exports.mjs), adds linked worktrees to it, and runs
# them there with a shell that exports PORT, DATABASE_URL and APP_BASE_URL,
# as this machine's does. A stub `pnpm` on PATH records every call with the
# DATABASE_URL and PORT it saw, and fails the call whose arguments contain
# $SMOKE_PNPM_FAIL; `db:create` keeps a fake database list in the temp dir,
# `--filter @kumite/front e2e` sleeps and logs when it started and ended, and
# `db:drop-worktree` logs whether the worktree's back/.env was still there. No Postgres, no Playwright, nothing outside the temp dir — except
# one TCP listener on 127.0.0.1, for the "skip a listening port" case.
#
# Usage: bash scripts/worktree-env-smoke.sh
set -uo pipefail

for tool in git node; do
  command -v "$tool" >/dev/null || {
    echo "worktree-env-smoke: '$tool' is required" >&2
    exit 2
  }
done
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "worktree-env-smoke: not inside a git repository" >&2
  exit 2
}
tmp="$(mktemp -d)"
listener=""
cleanup() {
  [ -n "$listener" ] && kill "$listener" 2>/dev/null
  rm -rf "$tmp"
}
trap cleanup EXIT

main="$tmp/main"
wt="$tmp/wt"
pnpm_log="$tmp/pnpm.log"
e2e_log="$tmp/e2e.log"
mkdir -p "$tmp/bin" "$tmp/dbs" "$tmp/locks" "$wt"

cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
printf '%s\t%s\t%s\t%s\n' "$(basename "$PWD")" "$*" "${DATABASE_URL-<unset>}" "${PORT-<unset>}" >>"$SMOKE_PNPM_LOG"
if [ -n "${SMOKE_PNPM_FAIL:-}" ] && [[ "$*" == *"$SMOKE_PNPM_FAIL"* ]]; then
  echo "smoke: stubbed failure of 'pnpm $*'"
  exit 1
fi
case "$*" in
  *db:drop-worktree*)
    for arg in "$@"; do
      case "$arg" in /*) [ -f "$arg/back/.env" ] && env=yes || env=no; echo "drop $(basename "$arg") env=$env" >>"$SMOKE_PNPM_LOG.drops" ;; esac
    done
    ;;
  *db:create*)
    name="${DATABASE_URL##*/}"
    if [ -e "$SMOKE_DBS/$name" ]; then
      echo "db:create: database \"$name\" already existed — nothing to do"
    else
      : >"$SMOKE_DBS/$name"
      echo "db:create: database \"$name\" created"
    fi
    ;;
  *"@kumite/front e2e"*)
    tree="$(basename "$PWD")"
    echo "start $tree $(date +%s.%N)" >>"$SMOKE_E2E_LOG"
    sleep "${SMOKE_E2E_SECONDS:-2}"
    echo "end $tree $(date +%s.%N)" >>"$SMOKE_E2E_LOG"
    echo "saw PORT=$PORT FRONT_PORT=$FRONT_PORT VITE_API_URL=$VITE_API_URL DB=${DATABASE_URL##*/}"
    ;;
esac
exit 0
STUB
chmod +x "$tmp/bin/pnpm"
# A docker stub too (#412 review): worktree-prune.sh removes `docker run`
# Postgres containers named after each merged worktree. Without the stub, case
# (r) would reach the machine's real docker and force-remove any container
# whose name starts with a fixture tree's name (task-7-…) — with its volumes.
# `ps` answers nothing, so prune never gets an id to remove.
cat >"$tmp/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$SMOKE_DOCKER_LOG"
exit 0
STUB
chmod +x "$tmp/bin/docker"

g() { git -C "$main" -c user.name=smoke -c user.email=smoke@example.invalid -c commit.gpgsign=false "$@"; }

git init -q -b develop "$main" || exit 1
mkdir -p "$main/scripts" "$main/back" "$main/front"
cp "$repo/scripts/worktree-env.sh" "$repo/scripts/e2e.sh" "$repo/scripts/env-exports.mjs" \
  "$repo/scripts/worktree-prune.sh" "$main/scripts/"
cp "$repo/back/.env.example" "$main/back/.env.example"
echo '{}' >"$main/front/package.json" # git keeps no empty dir: front/ must exist
printf 'back/.env\nback/.env.bak\nfront/.env\nnode_modules/\n' >"$main/.gitignore"
g add -A && g commit -qm init || exit 1

# add_tree <dir> [<branch>]: a linked worktree on a new branch (detached
# without one), with the node_modules worktree-env.sh insists on.
add_tree() {
  if [ -n "${2:-}" ]; then
    g worktree add -q -b "$2" "$wt/$1" 2>/dev/null
  else
    g worktree add -q --detach "$wt/$1" 2>/dev/null
  fi
  mkdir -p "$wt/$1/node_modules"
}

LEAK=(PORT=3000 DATABASE_URL=postgres://kumite:kumite@localhost:5487/kumite APP_BASE_URL=http://localhost:5173)
# in_tree <dir> <command...>: runs it there with the leaky shell and the stub.
in_tree() {
  local dir="$1"
  shift
  (cd "$dir" && env "${LEAK[@]}" PATH="$tmp/bin:$PATH" TMPDIR="$tmp" \
    SMOKE_PNPM_LOG="$pnpm_log" SMOKE_DBS="$tmp/dbs" SMOKE_E2E_LOG="$e2e_log" \
    SMOKE_PNPM_FAIL="${fail:-}" SMOKE_DOCKER_LOG="$tmp/docker.log" "$@")
}
# wenv <dir> [args]: worktree-env.sh there. Sets out, rc, calls (the pnpm
# arguments of this run, one per line), dbs (the DATABASE_URL each saw).
wenv() {
  local dir="$1"
  shift
  : >"$pnpm_log"
  out="$(in_tree "$dir" bash scripts/worktree-env.sh "$@" 2>&1)"
  rc=$?
  calls="$(cut -f2 "$pnpm_log")"
  dbs="$(cut -f3 "$pnpm_log" | sort -u)"
}
# env_of <dir> <key>: the value worktree-env.sh wrote to that back/.env.
env_of() { sed -n "s/^$2=//p" "$1/back/.env" | tail -n 1; }
dbname() { env_of "$1" DATABASE_URL | sed 's#.*/##'; }

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
    printf '%s\n' "$out" | sed 's/^/       | /' | tail -n 15
  fi
}
says() { grep -qF -- "$1" <<<"$out"; }
not() { ! "$@"; }
called() { grep -qxF -- "--filter @kumite/back $1" <<<"$calls"; }
not_called() { ! called "$1"; }
in_range() { [ "$1" -ge "$2" ] && [ "$1" -lt "$3" ]; } # in_range <n> <from> <below>

echo "worktree-env smoke: $repo/scripts/{worktree-env,e2e}.sh"
echo

# --- cases -------------------------------------------------------------------

begin "(a) no back/.env in the main checkout -> the example, on the default server"
add_tree task-5-e task/5-e
wenv "$wt/task-5-e"
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "database kumite_task5 on :5433 (got $(env_of "$wt/task-5-e" DATABASE_URL))" \
  [ "$(env_of "$wt/task-5-e" DATABASE_URL)" = "postgres://kumite:kumite@localhost:5433/kumite_task5" ]
expect "the rest of back/.env comes from the example" grep -q '^JWT_SECRET=' "$wt/task-5-e/back/.env"
end

cat >"$main/back/.env" <<'ENV'
DATABASE_URL=postgres://kumite:kumite@localhost:5487/kumite
PORT=3000
JWT_SECRET=smoke
SES_FROM_EMAIL=Kumite <no-reply@example.invalid>
ENV

begin "(b) the main checkout is refused"
wenv "$main"
expect "non-zero exit" [ "$rc" != 0 ]
expect "says why" says "main checkout"
expect "no pnpm call" [ -z "$calls" ]
end

begin "(c) first run: own database and ports, the shell's exports never leak"
add_tree task-7-a task/7-a
wenv "$wt/task-7-a"
a_port="$(env_of "$wt/task-7-a" PORT)"
a_front="$(env_of "$wt/task-7-a" FRONT_PORT)"
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "database kumite_task7 (got $(dbname "$wt/task-7-a"))" [ "$(dbname "$wt/task-7-a")" = kumite_task7 ]
expect "back port 3007 or the next free one (got $a_port)" in_range "$a_port" 3007 3100
expect "front port 5007 or the next free one (got $a_front)" in_range "$a_front" 5007 5100
expect "APP_BASE_URL follows the front port" [ "$(env_of "$wt/task-7-a" APP_BASE_URL)" = "http://localhost:$a_front" ]
expect "front/.env points at the back port" grep -qx "VITE_API_URL=http://localhost:$a_port" "$wt/task-7-a/front/.env"
expect "db:create" called db:create
expect "db:migrate" called db:migrate
expect "db:seed" called db:seed
expect "every pnpm call saw this tree's database, never the shell's (saw: $dbs)" \
  [ "$dbs" = "postgres://kumite:kumite@localhost:5487/kumite_task7" ]
end

begin "(d) re-run keeps database and ports, migrates only"
wenv "$wt/task-7-a"
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "same database" [ "$(dbname "$wt/task-7-a")" = kumite_task7 ]
expect "same back port" [ "$(env_of "$wt/task-7-a" PORT)" = "$a_port" ]
expect "same front port" [ "$(env_of "$wt/task-7-a" FRONT_PORT)" = "$a_front" ]
expect "db:migrate" called db:migrate
expect "no db:seed" not_called db:seed
end

begin "(e) the database vanished -> a re-run seeds the new one"
rm -f "$tmp/dbs/kumite_task7"
wenv "$wt/task-7-a"
expect "seeded again" called db:seed
end

begin "(f) --reset re-seeds with db:reset"
wenv "$wt/task-7-a" --reset
expect "db:reset" called db:reset
expect "no db:seed" not_called db:seed
end

begin "(g) same number in another tree -> ports another back/.env names are skipped"
add_tree review-7
wenv "$wt/review-7"
b_port="$(env_of "$wt/review-7" PORT)"
b_front="$(env_of "$wt/review-7" FRONT_PORT)"
expect "database kumite_review7 (got $(dbname "$wt/review-7"))" [ "$(dbname "$wt/review-7")" = kumite_review7 ]
expect "back port differs from task-7-a's $a_port (got $b_port)" [ "$b_port" -gt "$a_port" ]
expect "front port differs from task-7-a's $a_front (got $b_front)" [ "$b_front" -gt "$a_front" ]
end

begin "(h) two branches of one issue -> the second database gets a suffix"
add_tree task-7-b task/7-b
wenv "$wt/task-7-b"
expect "kumite_task7_2 (got $(dbname "$wt/task-7-b"))" [ "$(dbname "$wt/task-7-b")" = kumite_task7_2 ]
end

begin "(i) a listening port is skipped"
node -e 'require("net").createServer().listen(3941, "127.0.0.1")' &
listener=$!
for _ in $(seq 1 50); do
  (exec 3<>/dev/tcp/127.0.0.1/3941) 2>/dev/null && break
  sleep 0.1
done
add_tree task-941-c task/941-c
wenv "$wt/task-941-c"
c_port="$(env_of "$wt/task-941-c" PORT)"
expect "past 3941, which is listening (got $c_port)" in_range "$c_port" 3942 4000
kill "$listener" 2>/dev/null
listener=""
end

begin "(j) --print: parsed values, safe to eval"
printf 'PORT="%s" # quoted, with a comment\nEVIL='"'"'$(touch %s/pwned)'"'"'\n' "$a_port" "$tmp" >>"$wt/task-7-a/back/.env"
out="$(in_tree "$wt/task-7-a" bash -c 'eval "$(bash scripts/worktree-env.sh --print)" && echo "PORT=$PORT VITE=$VITE_API_URL DB=${DATABASE_URL##*/} SES=$SES_FROM_EMAIL EVIL=$EVIL"' 2>&1)"
expect "the tree's values win over the shell's" says "PORT=$a_port VITE=http://localhost:$a_port DB=kumite_task7"
expect "a value bash cannot source survives" says "SES=Kumite <no-reply@example.invalid>"
expect "nothing in a value runs" [ ! -e "$tmp/pwned" ]
expect "the value comes through literally" says "EVIL=\$(touch $tmp/pwned)"
end

begin "(k) a bad PORT stops --print, and pnpm e2e with it"
cp "$wt/review-7/back/.env" "$tmp/review-7.env"
echo 'PORT=30x7' >>"$wt/review-7/back/.env"
: >"$e2e_log"
out="$(in_tree "$wt/review-7" bash scripts/e2e.sh 2>&1)"
rc=$?
expect "e2e exits non-zero (rc=$rc)" [ "$rc" != 0 ]
expect "says why" says "must be plain numbers"
expect "Playwright never started" [ ! -s "$e2e_log" ]
cp "$tmp/review-7.env" "$wt/review-7/back/.env"
end

if command -v flock >/dev/null; then
  # e2e_pair <slots>: e2e.sh in task-7-a, then in review-7 a second later.
  e2e_pair() {
    : >"$e2e_log"
    in_tree "$wt/task-7-a" env KUMITE_E2E_SLOTS="$1" KUMITE_E2E_LOCK_DIR="$tmp/locks" \
      KUMITE_E2E_POLL_SECONDS=0.2 SMOKE_E2E_SECONDS=2 bash scripts/e2e.sh >"$tmp/e2e-a.out" 2>&1 &
    local a=$!
    sleep 1
    in_tree "$wt/review-7" env KUMITE_E2E_SLOTS="$1" KUMITE_E2E_LOCK_DIR="$tmp/locks" \
      KUMITE_E2E_POLL_SECONDS=0.2 SMOKE_E2E_SECONDS=2 bash scripts/e2e.sh >"$tmp/e2e-b.out" 2>&1
    wait "$a"
    a_end="$(awk '$1 == "end" && $2 == "task-7-a" { print $3 }' "$e2e_log")"
    b_start="$(awk '$1 == "start" && $2 == "review-7" { print $3 }' "$e2e_log")"
    out="$(cat "$tmp/e2e-a.out" "$tmp/e2e-b.out")"
  }
  before() { awk -v x="$1" -v y="$2" 'BEGIN { exit !(x != "" && y != "" && x < y) }'; }

  begin "(l) one E2E slot -> the second run waits for the first"
  e2e_pair 1
  expect "the second says it waits" grep -qF 'busy — waiting' "$tmp/e2e-b.out"
  expect "the second starts after the first ends ($b_start vs $a_end)" before "$a_end" "$b_start"
  expect "task-7-a ran with its own env" says "saw PORT=$a_port FRONT_PORT=$a_front VITE_API_URL=http://localhost:$a_port DB=kumite_task7"
  expect "review-7 ran with its own env" says "saw PORT=$b_port FRONT_PORT=$b_front VITE_API_URL=http://localhost:$b_port DB=kumite_review7"
  end

  begin "(m) two E2E slots -> both run at once"
  e2e_pair 2
  expect "the second starts before the first ends ($b_start vs $a_end)" before "$b_start" "$a_end"
  expect "slot 2 of 2" grep -qF 'slot 2 of 2' "$tmp/e2e-b.out"
  end
else
  echo "  skip (l)/(m): flock not found"
fi

# first_run_fails <dir> <branch> <step>: a first worktree:env that dies at <step>.
first_run_fails() {
  add_tree "$1" "$2"
  fail="$3" wenv "$wt/$1"
  fail=""
}

begin "(n) a first run that failed at db:migrate -> the re-run seeds"
first_run_fails task-80-n task/80-n db:migrate
expect "the first run failed (rc=$rc)" [ "$rc" != 0 ]
wenv "$wt/task-80-n"
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "db:seed" called db:seed
end

begin "(o) a first run that failed at db:seed -> the re-run seeds"
first_run_fails task-81-o task/81-o db:seed
expect "the first run failed (rc=$rc)" [ "$rc" != 0 ]
wenv "$wt/task-81-o"
expect "db:seed" called db:seed
wenv "$wt/task-81-o"
expect "a third run only migrates" not_called db:seed
end

begin "(p) a --reset that failed -> the next plain run seeds"
fail=db:reset wenv "$wt/task-7-a" --reset
fail=""
expect "the reset failed (rc=$rc)" [ "$rc" != 0 ]
wenv "$wt/task-7-a"
expect "db:seed" called db:seed
end

# --- worktree:prune's database step (#395) ------------------------------------
# Every branch above sits on the first commit; moving origin/develop one commit
# past it makes them all "merged". review-7 is detached, so it is kept.
echo x >"$main/later" && g add later && g commit -qm later
g update-ref refs/remotes/origin/develop "$(g rev-parse HEAD)"
branch_trees() { git -C "$main" worktree list --porcelain | grep -c '^branch '; }
before_prune="$(branch_trees)"
prune() {
  : >"$pnpm_log"
  : >"$pnpm_log.drops"
  out="$(in_tree "$main" bash scripts/worktree-prune.sh "$@" 2>&1)"
  rc=$?
}

begin "(q) prune: a drop that fails keeps the worktree and its back/.env"
fail=db:drop-worktree prune
fail=""
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "every merged tree kept ($(branch_trees) of $before_prune branch trees left)" [ "$(branch_trees)" = "$before_prune" ]
expect "says so" says "kept instead: db:drop-worktree failed"
expect "task-7-a still has its back/.env" [ -f "$wt/task-7-a/back/.env" ]
end

begin "(r) prune: databases dropped while back/.env is there, then the tree goes"
prune
expect "exit 0 (rc=$rc)" [ "$rc" = 0 ]
expect "the merged trees are gone (task-7-a)" [ ! -d "$wt/task-7-a" ]
expect "the detached review-7 stays" [ -d "$wt/review-7" ]
expect "db:drop-worktree ran for task-7-a with its back/.env in place" grep -qx 'drop task-7-a env=yes' "$pnpm_log.drops"
expect "never with the back/.env already gone" not grep -q 'env=no' "$pnpm_log.drops"
expect "docker reached only the stub, and only to look (ps)" grep -q '^ps ' "$tmp/docker.log"
expect "the stub was never asked to remove anything" not grep -q '^rm ' "$tmp/docker.log"
end

echo
if [ "$failures" = 0 ]; then
  echo "worktree-env smoke: all cases passed"
else
  echo "worktree-env smoke: $failures case(s) failed"
  exit 1
fi

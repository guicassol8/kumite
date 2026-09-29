#!/usr/bin/env bash
# Smoke test for scripts/pre-push-ladder.sh (#399): the scope guard that
# decides whether a push needs the gate ladder, and the ladder's refusals.
#
# It builds a throwaway repository in a temp dir (develop, with a local
# origin/develop ref) and runs the working copy of the script there, feeding
# it the lines git hands a pre-push hook on stdin
# (`<local ref> <local sha> <remote ref> <remote sha>`). A stub `pnpm` on PATH
# records each call, the DATABASE_URL it saw and any git repository variable
# it inherited, and fails the call whose
# arguments contain $SMOKE_PNPM_FAIL — nothing real is built or tested, and
# nothing outside the temp dir is touched.
#
# Usage: bash scripts/pre-push-ladder-smoke.sh
set -uo pipefail

command -v git >/dev/null || {
  echo "pre-push-ladder-smoke: 'git' is required" >&2
  exit 2
}
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "pre-push-ladder-smoke: not inside a git repository" >&2
  exit 2
}
script="$repo/scripts/pre-push-ladder.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

work="$tmp/work"
pnpm_log="$tmp/pnpm.log"
zero=0000000000000000000000000000000000000000
ladder=$'-r typecheck\n--filter @kumite/back exec kata verify --strict-coverage\n-r test'

mkdir -p "$tmp/bin"
cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
# The git repository variables this call inherited, by name — set counts,
# even empty (git exports GIT_PREFIX= to hooks).
inherited=""
for v in GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_PREFIX; do
  [ -n "${!v+set}" ] && inherited+="$v "
done
printf '%s\t%s\t%s\n' "${DATABASE_URL-<unset>}" "$*" "$inherited" >>"$SMOKE_PNPM_LOG"
if [ -n "${SMOKE_PNPM_FAIL:-}" ] && [[ "$*" == *"$SMOKE_PNPM_FAIL"* ]]; then
  echo "smoke: stubbed failure of 'pnpm $*'"
  exit 1
fi
exit 0
STUB
chmod +x "$tmp/bin/pnpm"

g() { git -C "$work" -c user.name=smoke -c user.email=smoke@example.invalid -c commit.gpgsign=false "$@"; }
# commit <message>: commits everything in the work tree, prints the new sha.
commit() {
  g add -A && g commit -qm "$1" && g rev-parse HEAD
}
# line <branch> <local sha> <remote sha>: one pre-push stdin line.
line() { printf 'refs/heads/%s %s refs/heads/%s %s\n' "$1" "$2" "$1" "$3"; }

# run_ladder <stdin lines> [VAR=value ...] — newline-terminated, as git sends
# them ("" = no refs at all).
# Sets: out (stdout+stderr), rc (exit code), calls (pnpm arguments, one per line),
#       dbs (the DATABASE_URL each pnpm call saw), gitenv (the GIT_DIR,
#       GIT_WORK_TREE… each call inherited, empty when none).
run_ladder() {
  local input="$1"
  shift
  : >"$pnpm_log"
  out="$(cd "$work" && printf '%s\n' "$input" | env -u DATABASE_URL \
    PATH="$tmp/bin:$PATH" TMPDIR="$tmp" SMOKE_PNPM_LOG="$pnpm_log" \
    "$@" bash "$script" 2>&1)"
  rc=$?
  calls="$(cut -f2 "$pnpm_log")"
  dbs="$(cut -f1 "$pnpm_log")"
  gitenv="$(cut -f3 "$pnpm_log" | tr -d '\n')"
}

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
  fi
}

exit_zero() { [ "$rc" = 0 ]; }
refused() { [ "$rc" != 0 ]; }
skipped() { [ -z "$calls" ] && grep -qF 'ladder skipped' <<<"$out"; }
full_ladder() { [ "$calls" = "$ladder" ]; }
says() { grep -qF -- "$1" <<<"$out"; }
only_calls() { [ "$calls" = "$1" ]; }

# --- fixture -----------------------------------------------------------------

git init -q -b develop "$work" || exit 1
mkdir -p "$work/back/src" "$work/docs"
echo 'export const a = 1' >"$work/back/src/a.ts"
echo '# doc' >"$work/docs/x.md"
echo '{}' >"$work/package.json"
base="$(commit init)" || exit 1
g update-ref refs/remotes/origin/develop "$base"

echo "pre-push ladder: $script"
echo

g checkout -q -b task/1-x
echo 'more' >>"$work/docs/x.md"
c_docs="$(commit docs)"
echo 'export const b = 2' >"$work/back/src/b.ts"
c_back="$(commit back)"
echo '{"private": true}' >"$work/package.json"
c_pkg="$(commit root-package-json)"
mkdir -p "$work/docs/tool"
echo '{}' >"$work/docs/tool/package.json"
c_nested="$(commit nested-package-json)"

g checkout -q -b task/2-y "$base"
echo '# y' >"$work/docs/y.md"
c_new_docs="$(commit new-branch-docs)"
echo 'export const c = 3' >"$work/back/src/c.ts"
c_new_back="$(commit new-branch-back)"
g rm -q "$work/back/src/c.ts"
c_delete="$(commit delete-only)"

# More file names than a pipe buffer holds (64 KiB), with back/ sorting first.
g checkout -q -b task/3-big "$base"
mkdir -p "$work/docs/bulk"
for i in $(seq 1 1600); do
  : >"$work/docs/bulk/a-deliberately-long-file-name-to-fill-the-pipe-buffer-$i.md"
done
echo 'export const z = 26' >"$work/back/src/z.ts"
c_big="$(commit big)"
big_bytes="$(g diff --name-only "$base" "$c_big" | wc -c)"

# --- cases -------------------------------------------------------------------

begin "(a) docs-only push -> ladder skipped, no pnpm"
run_ladder "$(line task/1-x "$c_docs" "$base")"
expect "exit 0" exit_zero
expect "skipped without pnpm" skipped
end

begin "(b) back/ change -> typecheck, kata verify, tests, in order"
run_ladder "$(line task/1-x "$c_back" "$c_docs")"
expect "exit 0" exit_zero
expect "the three steps ran (got: $(tr '\n' '|' <<<"$calls"))" full_ladder
end

begin "(c) root package.json -> ladder; a nested one outside back/front/blocks -> skipped"
run_ladder "$(line task/1-x "$c_pkg" "$c_back")"
expect "root package.json runs the ladder" full_ladder
run_ladder "$(line task/1-x "$c_nested" "$c_pkg")"
expect "docs/tool/package.json is skipped" skipped
end

begin "(d) new branch -> compared with its merge-base on origin/develop"
run_ladder "$(line task/2-y "$c_new_docs" "$zero")"
expect "docs-only new branch is skipped" skipped
run_ladder "$(line task/2-y "$c_new_back" "$zero")"
expect "new branch with back/ runs the ladder" full_ladder
end

begin "(e) a push that only deletes a back/ file -> ladder"
run_ladder "$(line task/2-y "$c_delete" "$c_new_back")"
expect "deletion under back/ runs the ladder" full_ladder
end

begin "(f) deleting a remote branch -> skipped"
run_ladder "(delete) $zero refs/heads/task/old $c_back"
expect "exit 0" exit_zero
expect "skipped without pnpm" skipped
end

begin "(g) remote sha unknown here -> falls back to the merge-base"
unknown=1234567890abcdef1234567890abcdef12345678
run_ladder "$(line task/2-y "$c_new_docs" "$unknown")"
expect "docs-only since develop is skipped" skipped
run_ladder "$(line task/2-y "$c_new_back" "$unknown")"
expect "back/ since develop runs the ladder" full_ladder
end

begin "(h) several refs, only the second one gated -> ladder"
run_ladder "$(line task/1-x "$c_docs" "$base")"$'\n'"$(line task/2-y "$c_new_back" "$zero")"
expect "the ladder ran" full_ladder
end

begin "(i) no refs on stdin (by hand) -> ladder"
run_ladder ""
expect "the ladder ran" full_ladder
end

begin "(j) stdin is a terminal -> ladder, no hang"
if command -v python3 >/dev/null && command -v timeout >/dev/null; then
  : >"$pnpm_log"
  (cd "$work" && env -u DATABASE_URL PATH="$tmp/bin:$PATH" TMPDIR="$tmp" \
    SMOKE_PNPM_LOG="$pnpm_log" timeout 20 python3 -c \
    'import pty, sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)' bash "$script" \
    </dev/null >/dev/null 2>&1)
  rc=$?
  calls="$(cut -f2 "$pnpm_log")"
  expect "did not hang (timeout exit 124)" [ "$rc" != 124 ]
  expect "the ladder ran" full_ladder
else
  echo "  (j) needs python3 and timeout — not checked"
fi
end

begin "(k) file list beyond the pipe buffer, back/ first -> ladder (SIGPIPE)"
expect "fixture lists more than 64 KiB of names (got $big_bytes bytes)" [ "$big_bytes" -gt 65536 ]
run_ladder "$(line task/3-big "$c_big" "$zero")"
expect "the ladder ran" full_ladder
end

begin "(l) a failing step refuses the push and stops the ladder"
run_ladder "" SMOKE_PNPM_FAIL="-r typecheck"
expect "non-zero exit" refused
expect "says typecheck FAILED" says "typecheck FAILED — push refused"
expect "nothing ran after typecheck" only_calls "-r typecheck"
run_ladder "" SMOKE_PNPM_FAIL="-r test"
expect "failing tests refuse the push" refused
expect "says tests FAILED" says "tests FAILED — push refused"
expect "names the full log" says "full output in $tmp/kumite-pre-push-work.log"
end

begin "(m) back/.env DATABASE_URL wins over the inherited one"
printf 'PORT=3999\nDATABASE_URL="postgres://smoke:secret@localhost:5439/kumite"\n' >"$work/back/.env"
run_ladder "" DATABASE_URL=postgres://inherited:secret@localhost:5433/kumite
expect "every pnpm call saw :5439 (got: $(sort -u <<<"$dbs" | tr '\n' ' '))" \
  bash -c '[ -n "$1" ] && ! grep -qvF ":5439/" <<<"$1"' _ "$dbs"
rm -f "$work/back/.env"
end

begin "(n) git's hook variables: the scope guard reads them, the ladder never sees them (#407)"
# git exports these to a hook; a test that runs git elsewhere would see them.
# The git dir sits outside the work tree (`git --git-dir … --work-tree … push`),
# so the guard reaches the repository only through them — unset them before it
# and the push is refused.
mv "$work/.git" "$tmp/work.git"
hook_vars=(GIT_DIR="$tmp/work.git" GIT_WORK_TREE="$work" GIT_INDEX_FILE="$tmp/work.git/index"
  GIT_COMMON_DIR="$tmp/work.git" GIT_OBJECT_DIRECTORY="$tmp/work.git/objects"
  GIT_ALTERNATE_OBJECT_DIRECTORIES="$tmp/work.git/objects" GIT_PREFIX=back/)
run_ladder "$(line task/1-x "$c_docs" "$base")" "${hook_vars[@]}"
expect "a docs-only push is skipped (rc=$rc)" skipped
run_ladder "$(line task/1-x "$c_back" "$c_docs")" "${hook_vars[@]}"
expect "a back/ push runs the ladder (rc=$rc)" full_ladder
expect "no pnpm call inherited any of them (got: $gitenv)" [ -z "$gitenv" ]
mv "$tmp/work.git" "$work/.git"
end

echo
if [ "$failures" = 0 ]; then
  echo "pre-push-ladder-smoke: all cases passed"
  exit 0
fi
echo "pre-push-ladder-smoke: $failures case(s) failed"
exit 1

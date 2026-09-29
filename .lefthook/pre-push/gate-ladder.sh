#!/usr/bin/env bash
# lefthook `script:` job for the pre-push (#399): hands git's stdin and
# arguments to scripts/pre-push-ladder.sh, which decides whether the push
# needs the gate ladder.
#
# Why a script job and not `run:` — lefthook skips a `run:` job on pre-push
# ("no matching push files") whenever its own list of push files, `git diff
# HEAD @{push}` keeping only files that still exist, comes out empty. That
# list is about HEAD, not about what is being pushed, so the ladder never ran
# for a push that only deletes files under back/, nor for `git push origin
# <other branch>` while HEAD's own branch is in sync. `script:` jobs skip no
# such check. Keep this file here (lefthook's source_dir): a `script:` path
# that climbs out with ../ is found under .lefthook-local/ too and runs twice.
exec bash "$(git rev-parse --show-toplevel)/scripts/pre-push-ladder.sh" "$@"

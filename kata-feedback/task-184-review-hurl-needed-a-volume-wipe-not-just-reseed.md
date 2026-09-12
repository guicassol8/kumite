# Reviewing #184's PR: hurl re-run needed a full volume wipe, not just db:seed

**Found while**: reviewing-tasks for PR #250 (task-184, round ranking phantom-team filter)
**Where in kata**: hurl runner, read-only — no kata changes made

## What

`kata verify --strict-coverage` was clean on the first try (65 files, no
findings) and needed no re-run. The hurl suite took three attempts to get a
clean 15/15 in this review worktree:

1. First run failed 9/15 files on `POST /auth/login` returning 401 for the
   organizer — the DB had been freshly migrated but never seeded before the
   first hurl invocation.
2. After `pnpm db:seed`, a second run failed 11/15 on `POST /auth/signup`
   returning 400 `signup_failed` — the first (partial) run had already
   created several of the suite's fixture users, so signup now collided on
   duplicate emails. `db:seed` alone doesn't clear prior hurl fixture data,
   only the organizer/base fixtures.
3. Only a full `docker compose down -v && up -d && db:migrate && db:seed`
   plus a from-scratch `pnpm dev:back` gave a clean 15/15 (319 requests).

None of this touched the module under review (`ranking.hurl` passed on
every attempt once the environment was actually clean) — it's pure
environment hygiene, already covered by an existing local note
(kumite-hurl-runtime-gotchas / kumite-e2e-reseed-after-every-commit in this
session's memory), not a kata-framework bug. Filing here anyway since it's
the same shape of friction as several prior review sessions
(review-141-verify-clean-hurl-needed-a-volume-wipe.md,
task-156-review-hurl-suite-not-idempotent-after-vitest.md): the hurl suite
has no teardown/reset step of its own, so any non-fresh DB (including one a
previous *failed* hurl run partially populated) needs a full volume
recreate, not just a re-seed, before a meaningful pass/fail read.

## Why it matters

This is now the ~4th independent report of the same shape (hurl suite
requires a fully virgin DB to be trustworthy, and a partial/failed prior
run makes the *next* run fail for an unrelated reason — duplicate-email
signups, stale JWTs, etc.). A `hurl --clean` / a documented
"truncate-before-run" step in the hurl runner itself (or a
`pnpm hurl:reset` script alongside `db:seed`) would remove a recurring
5-10 minute detour from every review session that runs the back suite
twice in the same DB.

## Metrics

- kata-docs MCP queries: 0 — nothing here needed kata's own docs, this is
  entirely a kumite-side DB lifecycle question.
- Extra turns caused: 2 (diagnose 401s → diagnose signup 400s → wipe volume),
  ~3 minutes of wall clock, no context cost since the fix was mechanical
  once the pattern was recognized from memory.
- `kata verify`: 1 invocation, clean, no false positives.

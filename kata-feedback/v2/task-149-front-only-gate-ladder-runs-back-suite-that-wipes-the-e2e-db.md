# A front-only task's gate ladder wipes the database its own e2e run needs

**Found while**: #149 — reapontar as specs e2e que navegavam para `/problem`
**Where in kata**: nothing in kata itself; `kata verify` clean, zero `kata-docs`
lookups. The friction is in the gate ladder around it.

## What

This task touched only `front/e2e/**` — five Playwright specs and a new helper.
No back code, no routes, no schemas. Still, every commit ran the full ladder,
and the back vitest suite inside it **truncates the shared Postgres**. The
e2e specs need a seeded organizer to run at all, so the loop was:

1. run the e2e spec → green;
2. `git commit` → pre-commit runs `pnpm -r test` → back suite truncates `users`;
3. run the same e2e spec again → `organizer login failed … invalid_credentials`;
4. `pnpm --filter @kumite/back db:seed` → green again.

I hit step 3 twice before recognising it, and re-seeded before every e2e run
afterwards. The first occurrence cost a false diagnosis: the fixture reported
`could not open the round after 5 attempts: unauthorized`, blaming the round
endpoint, when the real failure was the organizer login upstream returning no
token and every later call going out as `Bearer undefined`. I added an explicit
guard in the fixture so the message names the real cause.

`kata verify` itself was clean on every run (60 files, ~0.7s) and never had
anything to say about a front-only diff — correct, just not useful here.

## Why it matters

Two independent consumers of one database — the back unit suite (truncates) and
the e2e suite (needs a seeded organizer) — with the commit hook interleaving
them. Already reported from other angles
(`hurl-and-unit-tests-fight-over-one-database.md`,
`task-134-front-only-gate-ladder-runs-the-whole-back-suite.md`,
`verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`); this is a
fourth sighting, which suggests it is the default experience for a front task
rather than bad luck. The symptom is always the same shape: a green spec that
turns red purely because a commit happened between two runs, and an error
message that points at the wrong layer.

Worth noting the harness did NOT cause the task's real blocker — a spec leaking
an open round for 30 minutes (kumite issue #150). That one is kumite's own.

## Metrics

- `kata-docs` MCP queries: **0**. Nothing in the task was kata-shaped; guessing
  was never on the table, so no lookup could have paid for itself. Token cost of
  kata-docs this task: zero.
- `kata verify`: 6 runs (5 commits + `pnpm check`), ~0.7s each, always clean,
  0 findings on a front-only diff.
- Gate-ladder cost per commit: ~80-90s, of which the back vitest suite is
  ~65-73s — spent entirely on code this task never touched, and the part that
  wiped the database the task did need.
- Turns lost to the wipe-then-fail-then-reseed cycle: **3** (two false failures
  plus the investigation that traced `unauthorized` back to a truncated `users`
  table).
- E2E wall-clock: full suite 3.9-5.4 min per run; the five fixture specs alone
  18s.

## Suggested fix (optional)

Nothing for kata to fix here. If anything is worth changing it is kumite-side:
scope the pre-commit ladder to the packages a commit actually touches, or give
the e2e suite a database the back unit suite does not truncate. Recording it
here because the previous three sightings are also in this folder and the
pattern is now hard to call incidental.

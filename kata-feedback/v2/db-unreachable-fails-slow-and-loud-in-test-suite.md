# A DB-unreachable test run costs 6 minutes and 338 stack dumps instead of one line

**Found while**: kumite #144 (global footer — a **front-only** task)
**Where in kata**: the DB-backed test surface exercised by `vitest run` in
`back/`; adjacent to `kata verify` in the gate ladder the hooks run.

## What

Committing a front-only change fired the pre-commit gate ladder, which runs
the full `back/` suite. This worktree's Postgres (`DB_PORT=5439`) wasn't up
yet, so every DB-backed test failed. The way it failed is the observation:

- **338 of 422 tests failed individually**, each printing a fully serialized
  `AggregateError` — both the IPv6 and IPv4 `ECONNREFUSED` variants, with
  `constructor: 'Function<Error>'` / `toString: 'Function<toString>'` noise
  on every one.
- The run took **366 seconds**, almost all of it `beforeEach` hooks timing
  out at 10s apiece before reporting `Hook timed out in 10000ms`.
- The actual cause — "nothing is listening on 5439" — appears nowhere as a
  distinct message. It's derivable only by reading one of the 338 dumps.

`format`, `typecheck` and `kata-verify` all passed in the first 19 seconds.
The remaining 6 minutes produced no information that the first failure
didn't already contain.

## Why it matters

This is the standard failure mode for any kata consumer using per-worktree
databases (which kumite's own `docs/workflow.md` § Worktrees prescribes):
forget `docker compose up -d`, pay six minutes and scroll past a few
thousand lines of serialized error objects to learn that the DB is down.
For an agent it's worse than for a human — the output is large enough to
matter in context, and the signal-to-noise ratio is near zero.

It also mis-attributes: the run *looks* like the change broke 338 tests.

## Metrics

- **kata-docs lookups this task: zero.** #144 is front-only (React component,
  i18n catalogs, a route layout line, a Playwright spec) — no route, schema,
  DI, JWT or error-surface work, so nothing to ask kata about. No tokens
  spent, none needed.
- **`kata verify`: consistently clean and fast** — 0.75s / 0.71s / 0.87s /
  0.81s across four hook runs. Correctly a no-op for a front-only diff; zero
  false positives.
- **Gate-ladder cost on a front-only task**: ~91–113s per commit when the DB
  is up (back 422 tests ≈ 47s + front 391 tests ≈ 26s), ~366s when it isn't.
  Four commits in this task ⇒ roughly 12 minutes of ladder, of which the
  back suite — untouched by every one of those commits — is the majority.
- **The failed run's cost**: 1 wasted commit attempt, ~6 minutes wall clock,
  and the largest single tool output of the session, for one bit of
  information.

## Suggested fix (optional)

A connectivity preflight in the DB test setup: one attempt to reach
`DATABASE_URL` before the suite starts, and on `ECONNREFUSED` fail the whole
run immediately with the URL and a "is the database running?" hint, instead
of letting each `beforeEach` discover it independently. Six minutes and 338
dumps become one line in under a second.

Trimming the serialized-error verbosity (the `constructor`/`toString`
entries carry nothing) would help independently of the preflight.

# Reviewing a mostly-e2e PR: kata was inert, `kata verify` was free

**Found while**: reviewing PR #153 (issue #150 — e2e suite not re-runnable)
**Where in kata**: `kata verify --strict-coverage`, the lefthook gate ladder,
hurl

## What

The review ran the whole gate ladder repeatedly (twice per commit through
pre-commit, plus standalone runs) against a diff that was 17 files of Playwright
fixtures and one `streamSSE` handler. Three plain observations, no bug:

1. **`kata verify` cost effectively nothing and said nothing.** 0.74–0.76s for
   60 files, green on every invocation. For a diff of this shape that is the
   right answer, and the price is low enough that its presence in the gate
   ladder never came up as friction. Compare with the rest of the ladder in the
   same pre-commit run: format 0.45s, typecheck ~15s, tests ~68s. `kata verify`
   is 1% of the gate.

2. **The hurl suite is not self-contained against state another tool leaves
   behind.** `teams.hurl:111` and `:439` assert `$.maxTeamSize == 3`, the seeded
   default. Running `pnpm -r test` before hurl leaves `event_config.maxTeamSize`
   at `6` — `back/src/modules/event-config/event-config.test.ts:59` writes it and
   `db:seed` does not reset the row, it only inserts when absent. So a perfectly
   ordinary "tests, then hurl" sequence fails two assertions in `teams.hurl`
   with no hint that the cause is a *different* test suite. A truncate + re-seed
   fixes it, and then 14/14 files and 267 requests pass in 6s.

   This is kumite's fixture design, not a kata bug — but the surface it lands on
   is kata's: hurl gives a per-request assert failure with no notion of "the
   world was not in the state this file documents in its header comment". Every
   `.hurl` file here opens with a comment naming its prerequisites
   (`# event_config (mixingLocked: false, maxTeamSize: 3)`); nothing checks
   them. A `[Options]`-style precondition block, or even a convention for a
   first request that asserts the documented preconditions and fails with
   "precondition not met" instead of "expected 3, actual 6", would turn ten
   confusing minutes into one line.

3. **The one back change in this PR was outside everything kata inspects**, same
   as the implementer already recorded in
   `task-150-sse-route-fix-zero-docs-lookups.md`. Reviewing it meant reading the
   handler and the existing `sse.test.ts`, not consulting any kata surface. That
   file's point 2 (the `output: {}` escape hatch on a never-closing stream) held
   up under review: the buffering rewrite kept it, and it still has to be there.

## Why it matters

Point 2 is the only actionable one, and it's mild: hurl's failure mode for
"someone else moved the shared state" is a value mismatch deep in a file, which
reads like a regression in the code under test. Anything that lets a `.hurl`
file state its preconditions as assertions rather than as a comment would pay
for itself the first time it fires.

## Metrics

- **kata-docs MCP queries made: 0.** Nothing in the review needed a kata API.
  The back diff was a concurrency ordering fix inside a handler body; the rest
  was Playwright. Guessing was never the alternative — there was nothing to
  look up. Consistent with the implementer's own report on this task.
- `kata verify --strict-coverage`: ~0.75s, 60 files, run ~6 times, always green,
  never the reason for a re-run.
- Time actually lost in the review: ~10 minutes chasing the hurl `maxTeamSize`
  failure before recognising it as `pnpm -r test` leftovers rather than a defect
  in the PR. Zero of that was kata-docs; all of it was fixture archaeology.
- Total review turns: ~40. Framework-attributable: 1 (re-running hurl after a
  truncate + re-seed).

## Suggested fix (optional)

For point 2 only, and optional: a documented convention (or a hurl helper file)
for asserting a suite's preconditions up front, so "the shared row is not what
this file assumes" fails as a precondition rather than as a bad value.

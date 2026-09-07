# kata verify clean reviewing a test-only flaky-timing fix (#120, PR #127)

**Found while**: `reviewing-tasks` on PR #127, closing #120 (the judge
concurrency test's flaky absolute-timing assertion, discovered from #62's
review of PR #119).
**Where in kata**: `kata verify --strict-coverage`.

## What

The fix only touched `back/src/modules/judge/judge.test.ts` — two
absolute-margin tests (`>= 350`, `< 350` wall-clock ms) merged into one
relative-timing test (`parallelElapsed < serialElapsed * 0.75`), reasoning
purely from the module's own `acquireSlot`/`releaseSlot` counting semaphore
in `judge.service.ts`. No route, schema, DI wiring, or error surface
changed, so there was nothing for `kata-docs` to answer — the whole review
was a gate-ladder run: `pnpm -r typecheck`, `pnpm verify`
(`✓ kata verify: no problems found (56 files checked)`), `pnpm -r test`
(383/383 back, 332/332 front, 40/40 blocks), plus 5 extra standalone runs
of just the changed test file to reconfirm the fix doesn't just move the
flakiness in the other direction.

## Why it matters

Another data point (alongside `verify-clean-on-leaderboard-review-fix.md`,
`verify-clean-review-108.md`, `verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`)
that a test-only back change costs zero kata-docs round-trips: the
framework surface here was entirely "does the existing gate ladder stay
green," never "what does kata's API look like."

## Metrics

- kata-docs queries: 0 (of this review's total token/turn budget).
- `kata verify` runs: 1, clean, well under a second.
- Extra `vitest run` invocations for flake-reconfirmation: 5/5 clean —
  cheap given the test's own ~7-11s wall time, worth it for a test whose
  entire purpose is timing reliability.

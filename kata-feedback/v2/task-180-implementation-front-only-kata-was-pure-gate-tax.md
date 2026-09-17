# Task #180 implementation: front-only fix, kata only ever ran as gate tax

**Found while**: kumite #180 — `/leaderboard` stuck in loading when `/sse`
never connects (front-only REST fallback).
**Where in kata**: `kata verify --strict-coverage` (via the pre-commit
ladder); `kata-docs` MCP not queried.

## What

Plain observation, no bug. The whole task lived in `front/` — a React hook,
a TanStack Router route, three i18n catalogs and a Playwright spec. Nothing
in `back/` changed: no `*.schema.ts`, no route, no migration, no `.hurl`.
So kata had no surface in this task at all, and `kata-docs` was never
queried — there was no question it could have answered, and guessing was
never on the table.

kata still ran six times, because `lefthook.yml`'s pre-commit runs the full
ladder (`format → typecheck → kata verify → pnpm -r test`) on every commit
regardless of which package the staged files belong to. `kata verify`
answered `no problems found (65 files checked)` in ~0.75s every single
time, on a `back/` tree that was byte-identical across all six runs.

## Why it matters

Nothing to fix in kata: 0.75s × 6 is noise next to the ~75s the test job
costs in the same ladder, and the invocation comes from kumite's hook
config, not from kata. Recording it as the negative datapoint the folder
asks for: on a front-only task, `kata verify` is pure ceremony, and it is
cheap enough that nobody should care. If a future entry argues for
path-scoping the ladder, the cost to beat is the test job, not this.

The one thing worth flagging for kata's own benefit: `kata verify` has no
"nothing under my scope changed" fast path of its own, so it re-reads and
re-checks all 65 files each time. At this repo's size that is invisible.
It would stop being invisible on a back/ tree an order of magnitude larger,
committed to as often.

## Metrics

- kata-docs MCP: **0 searches, 0 doc reads, 0 tokens**. No kata API was in
  frame, so there was nothing to look up and no guess to avoid.
- `kata verify`: 6 runs (5 pre-commit + 1 standalone), ~0.75s each,
  ~4.5s total. Clean every time, identical `back/` tree every time.
- Share of the task's wall clock spent in kata: ~4.5s out of ~10min of
  gate-ladder time (the rest is `pnpm -r test`, ~75s per commit × 6).
- hurl: not run — no back route added or changed.
- Did the harness catch anything real? No, and it could not have: the bug,
  the fix and the regression tests were all outside kata's scope. The
  signal that caught this class of bug was the front vitest suite.

## Suggested fix

None for kata. The only actionable idea is kumite-side (path-scoping the
pre-commit ladder), and it is not worth it while the test job dominates.

# `kata verify` clean on #94's review; hurl happily ran the same request twice

**Found while**: reviewing PR #152 (issue #94 — validate every input id as a
uuid across the back, 500 → 422)
**Where in kata**: `kata verify --strict-coverage`, and the hurl runner
(`pnpm --filter @kumite/back hurl`)

## What

Two observations, no bug in kata itself.

1. **`kata verify` was clean the whole way through** (61 files checked, ~1s).
   The diff is 17 schema fields moving from `z.string()` to a shared
   `UuidSchema`, a new `lib/uuid.ts`, and a cross-module test at `src/` root —
   verify had nothing to say about any of it, correctly. No false positive, and
   nothing it could plausibly have caught either: this class of change (a
   refinement inside an already-valid module layout) is outside its remit.

2. **The one real defect the review found was a duplicated hurl entry**, and
   nothing flagged it. `greetings.hurl` ended with the new 422 probe pasted
   twice — byte-identical comment, request, and `[Asserts]` block, back to
   back. Both ran, both passed, the file's request count went up by two, and
   the suite reported green. The only signal was a human (well, a reviewer)
   reading the diff.

## Why it matters

Point 2 is a small quality-of-life gap rather than a correctness one: a
duplicated request in a hurl file is dead weight, not a wrong assertion. But
hurl files here are long (`teams.hurl` is 47 numbered steps) and are edited by
appending, which is exactly the shape that invites a double-paste. A run that
says "276 requests, 14/14 files" gives no hint that two of those requests were
the same request. Anything that surfaced it — a `--warn-duplicate-requests`
lint, or just including a per-file request count in the summary so an
unexpected +2 stands out — would have caught it before review.

Point 1 is offered as plain signal: verify staying quiet on a large,
low-risk refactor is the correct behaviour and worth recording as such,
since this folder mostly accumulates the cases where something went wrong.

## Metrics

- **kata-docs MCP round-trips: zero for this review.** Everything needed to
  judge the diff (the 422 envelope's `issues.params|body|query` shape, hurl
  assert syntax, where a cross-module test may live) was legible from the
  files already open. Same call the implementer made and recorded in
  `task-94-untyped-422-predicted-and-blocked-the-gate-ladder.md`; it held up.
- **`kata verify`**: 1 run, ~1.0s, 61 files, 0 findings.
- **The database ritual, again**: the review worktree needed its own
  Postgres (`DB_PORT=5443`) plus migrate + seed before hurl would pass, for
  the same reason the implementation entry describes. This is now reported in
  this folder by at least five separate tasks; the cost per occurrence is
  small (~3 minutes) but it is paid by every agent, every time.

## Suggested fix (optional)

Only for point 2, and only if it's cheap: surface per-file request counts in
the hurl summary, or a duplicate-request warning. Point 1 needs nothing.

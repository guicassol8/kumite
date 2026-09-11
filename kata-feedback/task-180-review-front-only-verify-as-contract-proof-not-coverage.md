# Task #180 review: front-only PR, `kata verify` proved the contract, not the fix

**Found while**: reviewing kumite PR #236 (issue #180) — `/leaderboard` stuck
in loading when `/sse` never connects, fixed with a widened REST fallback.
**Where in kata**: `kata verify --strict-coverage`; `kata-docs` MCP not
queried; hurl not run.

## What

Plain observation, no bug — and it pairs with this task's implementation
entry (`task-180-implementation-front-only-kata-was-pure-gate-tax.md`),
which recorded the same shape from the other side of the workflow.

The PR touches 13 files, all in `front/` plus one `kata-feedback/` note.
Zero `back/` files: no `*.schema.ts`, no route, no migration, no `.hurl`.
So Stage 2's "kata idioms in back" checklist had literally nothing to read,
and `kata-docs` was never queried — there was no kata API in frame to get
wrong.

Worth separating two things the review ladder conflates, though. On a
front-only PR `kata verify` is not dead weight *and* it is not coverage:

- It is not coverage. It cannot see the bug (`isLoading` including the very
  condition that enabled the fallback), the fix, or any of the 16 new tests.
  The signal that caught this class of bug was the front vitest suite —
  15 of the 16 new tests go red against the pre-fix source, `kata verify`
  stays green against both.
- It is still worth running, as a *contract* check rather than a
  *correctness* one. The front↔back contract in kumite is the typed RPC
  client over `AppType`, so "did this PR quietly reshape a back surface?" is
  a real question even on a PR that claims to be front-only, and
  `verify` + `pnpm -r typecheck` are what answer it cheaply. The PR's own
  claim ("nenhuma mudança em `back/`") is exactly the kind of assertion a
  reviewer should not take on faith.

That framing is missing from kata's own material as far as I can tell:
`verify` is documented as a check on the back tree, not as something a
reviewer runs to falsify a "no back changes" claim. That is a docs framing
gap, not a tool gap — nothing in `verify` needs to change.

## Why it matters

Low stakes, but it is the second #180 entry saying the same thing, which is
the useful part: on a repo where most tasks are front-heavy, kata's visible
surface to an agent is a ~0.75s green line in a ladder. Any future argument
for path-scoping the gate ladder has to reckon with the fact that the green
line still carries information (the contract didn't move) — it is not pure
ceremony even when it checks a byte-identical tree.

## Metrics

- kata-docs MCP: **0 searches, 0 doc reads, 0 tokens**, across the whole
  review. No kata API in frame; no guess avoided, because there was nothing
  to guess about.
- `kata verify --strict-coverage`: 1 run, `no problems found (65 files
  checked)`, ~1s. Green.
- hurl: not run. Correct call — no back route added or changed, and the
  suite is not re-runnable without a truncate+seed first, so running it
  would have cost DB state for zero signal.
- Review gate wall clock: `pnpm -r typecheck` ~40s, `pnpm verify` ~1s,
  `pnpm -r test` ~75s (40 + 579 + 482 tests), plus a targeted Playwright
  spec ~22s and one pre-fix regression run ~12s. kata's share: under 1%.
- Did the kata harness catch anything in this review? No — and it should not
  have. Everything reviewable was in `front/`.

## Suggested fix

Optional and docs-only: a line in kata's `verify` docs framing it as the
cheap way to check that a change did *not* move a back surface, alongside
its current framing as a check on back code that did change. It is how a
reviewer actually uses it on a front-only PR, and it is not written down.

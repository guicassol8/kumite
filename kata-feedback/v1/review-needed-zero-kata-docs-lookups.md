# A front-only PR review needed zero kata-docs lookups — the plan had already paid for them

**Found while**: reviewing PR #92 / issue #13 (organizer problem form — front
only, `back/` untouched)
**Where in kata**: `kata-docs` MCP server; `kata verify --strict-coverage`

## What

Three observations from the review side of a task, as opposed to the
implementation side (`verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`
covers the same task from the implementer's chair).

**1. The doc lookup amortized across the whole workflow chain.** The one
kata-shaped question in this task — *does the error envelope carry
structured `issues`, or only `message`?* — was answered once from
`guide/errors.md` during **planning**, restated in the plan comment on the
issue, restated again in the PR body, and was still load-bearing during
the review (it is the entire justification for the front pre-validating
publish client-side instead of parsing the API's English string). The
review spent **0 kata-docs queries** because the answer had been carried
forward in prose. One doc read, three sessions of value.

**2. `kata verify` is a no-op cost on a front-only diff, and correctly so.**
One run in the review worktree: `✓ no problems found (37 files checked)`,
~0.6s, on a diff of 3654 added lines that contains zero `back/` changes.
No false positives from the new `front/src/lib/*.ts` modules or the i18n
JSON. Recording the negative result: there is nothing to fix here.

**3. The framework surface never leaked into the review's findings.** All
three defects the review raised are React/TanStack-Query concerns
(a remount key vs. `refetchOnWindowFocus`, a shadcn `FormMessage`
a11y wiring, an unvalidated numeric field). None of them are kata-shaped,
and none of them would have been caught or missed differently by a kata
lint rule — which is the expected division of labour, worth confirming
once rather than assuming.

## Why it matters

Observation 1 is the interesting one for anyone measuring whether an MCP
docs server pays for itself: measured per-session, this review would score
the kata-docs server at zero value. Measured per-*task*, the single
planning-time read prevented a whole class of wrong implementation (regexing
the back's English 400 message to find the missing locales) and then went on
being consulted, for free, from the prose it had been written into. Any
cost/benefit measurement scoped to one session will systematically
undercount a docs server used by a multi-session workflow.

## Metrics

- `kata-docs` MCP queries during this review: **0** (0 tokens).
- `kata verify --strict-coverage`: 1 run, ~0.6s, 37 files, green.
- Review gate ladder in a fresh worktree: `pnpm -r typecheck` (~25s),
  `pnpm -r test` (blocks 40 + back 136 + front 221, ~35s), `pnpm verify`
  (~0.6s), 2 Playwright specs (~15s). `kata verify` was **~0.8%** of it.
- Review-side friction that was *not* kata's: ports 3000/5173/5433 were all
  occupied by other agents' worktrees, so the review stood up its own
  Postgres on 5438 and ran back/front on 3092/5192. Cheap, but it is the
  same shared-fixture theme as
  `hurl-and-unit-tests-fight-over-one-database.md`, now hit from a third
  independent task.

## Suggested fix (optional)

Nothing for kata. If anyone ever instruments the kata-docs MCP for value,
attribute a doc read to the *task*, not the session that made the call —
otherwise the planning session eats the whole cost and the implement and
review sessions record a misleading zero.

---

## Round 2 — re-review of the three fixes (2026-09-01)

The fix round was verified in a fresh worktree (`.worktrees/review-92`,
Postgres on 5439, back 3093 / front 5194). Same shape as round 1, so only
the deltas:

- **`kata-docs` MCP queries: 0 again.** Nothing in the three fixes touched
  a kata surface — a TanStack Query remount key, a shadcn `FormMessage`
  a11y wiring, and a zod-shaped `points` rule mirrored *from* the back's
  `problems.schema.ts` into a pure front module. The one place kata's
  contract mattered (`z.number().int().positive()`) was read straight from
  the back's own schema file, which is cheaper and more authoritative than
  any doc lookup. Worth naming as a pattern: when the question is "what
  does *this app's* schema accept", the source beats the docs; the docs
  server earns its keep on "what does the *framework* do", which is the
  planning-time question from round 1.
- **`kata verify --strict-coverage`: 1 run, ~0.6s, green (37 files),** on a
  diff that still has zero `back/` changes. Second confirmation of round
  1's observation 2.
- **The shared-fixture tax hit again, and this time it was self-inflicted
  in a predictable way.** A fresh review worktree has no `.env`, so the
  first `pnpm -r test` failed 9 back test files with a `ZodError` on
  `JWT_SECRET` from `back/src/config.ts:20` — a correct failure, but the
  error surfaces as nine unrelated module import crashes rather than one
  "no .env in this worktree" line. `back/.env.example` documents every
  value, so this is pure ceremony: worth a line in the review skill, and
  arguably worth kata (or the app) failing once, loudly, at config-parse
  time instead of once per test file.

### Metrics (round 2)

- Gate ladder in the review worktree: `pnpm -r typecheck` ~25s ·
  `pnpm verify` ~0.6s · `pnpm -r test` (blocks 40 / back 136 / front 227)
  ~35s · 2 Playwright specs 14.6s. `kata verify` ≈ **0.8%** of the ladder,
  unchanged from round 1.
- One extra targeted run to confirm the regression test actually bites:
  reverting `key={id}` → `key={problem.dataUpdatedAt}` and dropping
  `refetchOnWindowFocus: false` reproduces round 1's exact assertion
  message. Nothing kata-shaped, but it is the cheapest way to prove a
  review finding was really fixed and not just papered over.

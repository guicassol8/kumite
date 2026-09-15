# A test-infra task where kata never entered the frame at all

**Found while**: planning #150 (suíte e2e não re-executável: um spec que falha
deixa a rodada aberta e envenena o slot único).

**Where in kata**: nowhere — and that is the observation.

## What

Metrics-only entry. `AGENTS.md` asks for a report whenever a task *touches*
kata; this one is the clean negative case, recorded so the "zero lookups"
series has a control group in it.

The task is entirely `front/e2e/` + `playwright.config.ts`. But the *diagnosis*
crossed into back code twice, and both times kumite's own source answered
immediately:

- **The invariant under test is a Postgres partial unique index**, not a kata
  surface: `rounds_single_open_idx` in `back/src/db/schema.ts:190`. Reading the
  index definition plus `openRound` in `rounds.service.ts:229` gave the whole
  failure model (friendly pre-flight via `findOpenRound`, real enforcement at
  the index, `DrizzleQueryError.cause` unwrapping for the race).
- **`reapExpiredRound` (`rounds.service.ts:34`) settled the "short rounds as a
  safety net" option** — lazy expiry on the read path means a leaked round with
  `durationMinutes: 1` self-heals, which is exactly what made that option
  presentable to the user as a real trade-off rather than a guess. Drizzle, not
  kata.

One design choice was made *specifically to keep kata out of the task*: the
issue's Acceptance #3 ("fail with a message naming the round holding the slot")
could have been implemented in the back, widening `openRound`'s error to carry
the holder. That would have pulled in `rounds.schema.ts`, `rounds.hurl`,
`kata verify` and a fullstack relabel of a `stack:front` issue. The user chose
the e2e-helper implementation instead. Worth naming because it is a case where
the *cost of touching a kata surface* — schema + hurl + verify + typecheck
round-trip — was itself an input to a product decision, not just an
implementation detail.

## Why it matters

The running series in this folder (`task-53`, `task-54`, `rounds-api`, `#143`)
all record zero kata-docs lookups on tasks that genuinely touched kata. This
entry is different: it records that a whole class of kumite work — E2E
determinism, shared-DB test pollution, Playwright fixture lifecycles — never
reaches kata's surface at all. If anyone is measuring kata-docs' value against
"kumite tasks" as the denominator, that denominator is inflated. The honest
denominator is "kumite tasks that touch a kata surface", and this one is not in
it.

## Metrics

- kata-docs MCP queries: **0**. Docs read: **0**.
- Planning cost: ~15 tool calls, all `cat`/`grep`/`gh` over kumite's own source,
  plus 2 batched rounds of AskUserQuestion (8 questions). None of it kata-docs.
- Turns lost to a kata dead end: 0.
- `kata verify` not run (planning writes no code); the plan explicitly records
  that this task leaves `kata verify` untouched.
- Did skipping the MCP cost anything? No — there was no kata question to ask.

## Suggested fix

None.

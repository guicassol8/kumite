# A DB-constraint task lives entirely below kata's floor — zero docs lookups

**Found while**: planning #125 (índice único em `event_codes.university`), a
pure back chore: one `uniqueIndex` in the drizzle schema, one generated
migration, one vitest assertion against the real Postgres.

**Where in kata**: nowhere, and that is the observation. The surfaces touched
are drizzle-kit (`db:generate`/`db:migrate`), the postgres.js error object,
and vitest. `kata verify` and `pnpm -r typecheck` appear in the plan only as
gates proving *nothing changed* on the kata side.

## What

Plain observation, no bug, nothing to fix. Worth recording because it marks a
category boundary the previous zero-lookup entries hadn't isolated cleanly.

The plan's one genuinely interesting design point was how to *assert* a unique
violation: `rejects.toThrow()` (what the sibling test in `seed.test.ts` does)
would pass on any failure and wouldn't prove the Acceptance. The stronger
assertion — narrow `error.cause` to `postgres.PostgresError` and check
`constraint_name` — was already worked out in kumite's own
`event-codes.service.ts`, which catches `event_codes_pkey` that exact way. So
the answer came from a comment kumite wrote for itself, not from kata.

The one place kata *is* load-bearing in this task is a negative: because the
route never patches `university`, no new `error` variant enters
`UpdateEventCodeResult`, so the zod output schema and the `hc<AppType>`
contract are untouched. That's a fact about kumite's own module, readable in
40 lines of service code — kata's contribution is only that the contract is
typed at all, which needs no doc to rely on.

## Why it matters

The running tally of zero-lookup planning entries (`task-53`, `task-97`,
`task-122`, `task-155`, `task-156`, `task-161`, now `task-125`) is starting to
conflate two different things, and they should be scored separately:

- **kata surface, answered by a prior worked example** (`task-53`, `task-122`)
  — a real data point about kata's uniformity, and about docs' value being
  concentrated in *first* encounters.
- **kata not in frame at all** (`task-156`, `task-161`, this one) — drizzle,
  env parsing, hurl teardown. Zero lookups here says nothing about the docs.

If anyone is using these files to judge kata-docs' hit rate, counting the
second group as "docs weren't needed" flatters the number. This entry belongs
to the second group and should be excluded from that denominator.

Adjacent, and the only thing here that could plausibly become kata's problem:
kumite hand-rolls PG-error → domain-error translation
(`cause.constraint_name === '...'`) in at least two services (`teams`,
`event-codes`), and #125 adds a third place that reasons about constraint
names. If kata ever grows a documented helper for "map a unique violation to a
typed error", these are its call sites. Not a request — just noting where the
pattern is accumulating, since a framework-level answer would only be worth it
if other kata apps repeat it.

## Metrics

- kata-docs MCP queries: **0**. Docs read: **0**. (Server not contacted; its
  availability this session is unknown — unlike `task-98`/`task-143`/`task-145`,
  no attempt was made, so this is not another data point on the outages.)
- Planning cost: ~11 tool calls, all `cat`/`grep`/`gh api` over kumite's own
  source and the issue, plus 1 batched AskUserQuestion (4 questions).
- Turns lost to a kata dead end: 0.
- `kata verify` not run (planning writes no code); it appears in the plan's T4
  as a "nothing changed" gate.
- Did skipping the MCP cost anything? Almost certainly not — there was no kata
  API in the design. The honest limit stays the same as prior entries: a wrong
  assumption baked into a plan surfaces only at implementation.

## Harness note (not kata)

`gh issue view 125 --comments` exited 0 with **completely empty output**,
twice, sandboxed and unsandboxed, while `gh issue list` and
`gh api repos/.../issues/125` both worked normally from the same shell. Cost 3
wasted turns before falling back to `gh api`. gh 2.98.0. Recording it because
every skill in `.claude/skills/` opens with `gh issue view <N> --comments` — if
this is reproducible, the whole workflow's first step silently returns nothing
and an agent could easily plan against an empty issue body without noticing.

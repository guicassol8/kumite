# A whole new kata module added with zero kata-docs lookups — and the hurl reset tax again

**Found while**: #54, the organizer panel overview (new `stats` back module +
`GET /organizer/stats`, plus the front screen).
**Where in kata**: `defineRoute`/`createApp` surface, `kata verify
--strict-coverage`, the `hurl` script.

## What

Two observations, one positive and one recurring cost.

**1. A new module needed no docs at all.** This task added a complete module
from scratch — `stats.schema.ts` / `stats.service.ts` / `stats.route.ts` /
`stats.hurl`, registered in `app.ts` — and not a single `kata-docs` query was
made. The neighbouring modules were a sufficient specification: `defineRoute`
with `use: [requireUser, requireOrganizer]`, `input: {}`, an `output` zod
schema, `c.get('db')`, and the "don't declare 401/403, they're middleware
short-circuits" convention (ADR-0011) all read straight off `event-config`.
That is a good sign for the framework's shape — the idiom is regular enough
to be learned by example — but it also means kata-docs contributed nothing
measurable to a task squarely in its domain.

`kata verify --strict-coverage` stayed green from the first run and never
had anything to say about the new module, including the `.hurl` coverage
check, which passed as soon as the file existed with the 401/403/200 trio.

**2. The hurl suite still can't be re-run without a full DB reset.** Picking
this task up mid-flight (a crashed editor left the worktree with committed-
nothing work and a dirty database), the first `pnpm hurl` run reported 6 of
14 files failing — `teams.hurl` asserting `maxTeamSize == 3` against an
actual `6`, `slotsAvailable == 2` against `5`, and so on. None of those were
real: they were leftovers from the previous session's own hurl run. After
`docker compose down -v` + `up -d` + `db:migrate` + `db:seed`, all 14 files
passed with zero changes to the code.

This is the same fragility already filed in
`hurl-and-unit-tests-fight-over-one-database.md` and
`hurl-test-mode-parallel-races-a-global-db-invariant.md`, but the angle here
is different: the failure mode is *misleading*, not just flaky. An agent
resuming an interrupted task sees six red files and has no signal that the
cause is stale state rather than its own half-finished work. The obvious
first reaction — start debugging the diff — is the wrong one.

## Why it matters

The verify/hurl ladder is the main thing standing between an agent and a bad
PR, so its false positives are expensive in a specific way: they cost the
most exactly when context is thinnest (a resumed session, a fresh chat).
Here it cost one reset cycle plus the reasoning to suspect state in the
first place — cheap for an agent that has read the repo's memory notes,
potentially a long wrong-turn for one that hasn't.

## Metrics

- kata-docs MCP queries this task: **0**. Docs read: 0 tokens. The neighbouring
  module was the documentation.
- `kata verify --strict-coverage`: ~0.7s per run, green on every one of the
  ~8 invocations (5 commits × pre-commit hook + 3 manual). Never flagged
  anything, never false-positived.
- Cost of the stale-DB hurl failure: 1 full run (~4.4s) + 1 reset cycle
  (down -v/up/migrate/seed, ~25s) + the turns to diagnose it. Second run:
  14/14 files, 266 requests, 5.4s.
- Unrelated but worth noting for the same ladder: the pre-commit hook's full
  `pnpm -r test` tripped once on the known-flaky judge concurrency timing
  assertion (`expected 828 to be less than 739.5`), which had passed minutes
  earlier in the same worktree. Retrying the identical commit went green.
  That test was already de-flaked once in #127; on a loaded machine the
  relative-timing assertion still isn't safe.

## Suggested fix (optional)

For the hurl suite, the cheapest honest improvement is not idempotency (some
of these files legitimately mutate global config) but a **precondition
check**: have `kata`'s hurl runner, or a documented `pnpm hurl:reset`
wrapper, refuse to run — or loudly warn — when the database isn't in its
seeded state. A single "database is not freshly seeded; run X first" line
would turn six confusing assertion diffs into one actionable sentence.

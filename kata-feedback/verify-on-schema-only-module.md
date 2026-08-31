# kata verify handles schema-only modules cleanly

**Found while**: reviewing PR #81 (issue #30, teams/team_members/event_config
data modeling, no service/route yet)
**Where in kata**: `kata verify --strict-coverage`

## What

The PR adds `modules/teams/` with only `teams.schema.ts` and `teams.test.ts`
(no `.route.ts`, `.service.ts`, or `.hurl` — this is a data-modeling-only
task, same shape as the earlier `#76` problems-catalog PR).
`kata verify --strict-coverage` ran clean (30 files checked, 0 problems)
despite the module missing 3 of the 5 conventional files.

## Why it matters

Confirms `kata verify` doesn't assume/require the full mandatory-layout file
set per module — it only checks what's present. Useful to know this is safe
for "modeling-first, routes-later" tasks, which this repo's workflow does
deliberately (see `docs/workflow.md`, kumite issues #24/#76/#30).

## Metrics

No kata-docs MCP queries needed for this review — the pass/fail signal from
`kata verify` itself was unambiguous and matched expectations from the prior
`#76` precedent, so no lookup was attempted. Zero overhead either way.

## Update — confirmed from the docs side, not just verify output (#35 planning)

**Found while**: planning-tasks for issue #35 (rounds/round_problems data
modeling, no route/service yet — same shape as #30/#76).

Before writing the plan I queried `kata-docs` (`search_docs` for "kata verify
rules module layout required files", then `read_doc` on
`guide/project-layout.md`) to double-check whether a `modules/rounds/` with
only `rounds.schema.ts` + `rounds.test.ts` is actually sanctioned, rather than
just something `kata verify` happens not to flag. The doc says it outright:
"The tree is normative, not exhaustive... `app.ts` is the only optional file
in the tree" is stated for the app root, and separately the module section
never claims all five files are mandatory per-domain — only that *if present*
they must use the locked suffix. So this is documented behavior, not an
accidental gap in the checker.

**Cost/payoff**: one search + one doc read, small relative to the rest of the
planning turn. Worth it here specifically because the plan was about to
commit to a "modeling-only module, route/service later" shape for a second
time (#30 was empirical/precedent-based; this one is doc-confirmed) — cheap
insurance against a wrong assumption baked into a posted plan.

## Update — confirmed again during implementation (#35)

**Found while**: implementing-tasks for issue #35 (`modules/rounds/` with
only `rounds.schema.ts` + `rounds.test.ts`, route/service deferred to #36).

Same result a third time: `kata verify --strict-coverage` after adding the
schema-only module reported "no problems found (33 files checked)" — no
warning about the missing `.route.ts`/`.service.ts`/`.hurl`. Pairs with the
doc-based confirmation already on this file from #35's planning phase
(`guide/project-layout.md`: the per-module file set is "if present, must use
the locked suffix," not mandatory-five). No new kata-docs lookup needed here
— the doc read from planning already settled it, this just re-ran the check
against the real files instead of a hypothetical.

**Metrics**: zero kata-docs tokens spent in this phase (relied on the
planning-phase doc read); `kata verify` itself is near-instant (<1s) as part
of the gate ladder, so this cost nothing beyond running the ladder anyway.

## Update — confirmed a fourth time during review (PR #83)

**Found while**: reviewing-tasks for PR #83 (`modules/rounds/`, same
schema-only shape as above).

Re-ran `kata verify --strict-coverage` myself against the PR's worktree
(clean checkout, `pnpm install` already done): "no problems found (33 files
checked)" — no complaint about `rounds/` missing `.route.ts`/`.service.ts`/
`.hurl`. Also re-ran the full migration from a throwaway clean Postgres
container (not the shared dev DB) to independently verify the "migrations
apply on a clean db" acceptance criterion — both migrations (schema +
custom trigger) applied without error, and `\d round_problems` showed the
trigger attached as expected.

**Metrics**: zero kata-docs MCP queries needed for this review — the
pass/fail signal from `kata verify` and a live migration run was
unambiguous, no doc lookup added value here.

## Update — the locked-suffix rule also blocks moving a worker script into a
module dir (issue #19)

**Found while**: planning-tasks for issue #19 (judge sandbox execution
service). `sandbox-engine.worker.ts` — the low-level worker entry point
characterized by an earlier spike — reads like ADR-0001 wants it to live
inside `src/modules/judge/`, but the file-naming lock only permits the five
conventional suffixes (`.route.ts`/`.service.ts`/`.schema.ts`/`.hurl`/
`.test.ts`) inside `src/modules/<domain>/`; a bare `<name>.worker.ts` isn't
one of them.

Queried `kata-docs` (`search_docs`, then `read_doc` on both
`guide/project-layout.md` and `adr/0018-file-naming-convention-enforcement.md`)
to confirm this before committing the plan to a file layout. Confirmed: the
lock is real and applies per the exact suffix, not "any file under the
domain folder." The plan kept `sandbox-engine.worker.ts` at `src/` root
(sibling to `app.ts`/`context.ts`), same place it already lived from the
spike.

**Cost/payoff**: 2 searches + 2 doc reads, small relative to the planning
turn. Directly changed the plan's shape — the first draft of the file list
would have tried to relocate the worker script into `modules/judge/` and
failed `kata verify`'s suffix rule on the very first run. Cheap insurance.

**Confirmed during implementation**: `modules/judge/` ended up with
`judge.schema.ts` + `judge.service.ts` + `judge.test.ts` (no `.route.ts`/
`.hurl` — this task has no HTTP surface) — `kata verify --strict-coverage`
clean throughout. A *second* root-level non-module file was also added
along the way (`src/judge-test-worker.mjs`, a plain-JS worker double used
only by `judge.test.ts` — see this repo's own implementation notes for why),
and `kata verify` accepted that too without complaint, confirming the
locked-suffix rule really is scoped to `src/modules/<domain>/` and doesn't
reach for files at `src/` root at all. Zero kata-docs queries needed in this
implementation turn — the planning-phase lookup already settled the
question, and reality matched it exactly.

## Update — review confirmation (PR #88, issue #19)

**Found while**: `reviewing-tasks` on PR #88. Re-ran `pnpm -r typecheck`,
`pnpm verify` (`kata verify --strict-coverage`) and the back test suite
against the merged worktree, independent of the implementer's own reported
numbers.

**What**: `kata verify --strict-coverage` stayed clean (35 files) with the
service module (`judge.service.ts`, a genuinely side-effecting
worker-thread orchestrator, not a thin CRUD wrapper) sitting alongside the
schema-only modules this file already covers — same result as planning
predicted, now confirmed from the reviewer's side too. No kata-docs MCP
queries were needed for this review: `verify`/`typecheck`/`test` are
already-documented gate commands, nothing about kata's own behavior was in
question.

**Metrics**: 0 kata-docs queries this session (review stage). All signal
came from re-running the existing gate commands and reading the diff — no
doc lookup would have added anything here.

## Update — schema+service, no route, fifth clean run (issue #18)

**Found while**: `implementing-tasks` for issue #18 (`modules/submissions/`
= `submissions.schema.ts` + `submissions.service.ts` + `submissions.test.ts`,
no `.route.ts`/`.hurl` — #21 owns the HTTP surface).

**What**: `kata verify --strict-coverage` clean again — "no problems found
(37 files checked)" — both standalone and inside the lefthook pre-commit
ladder, twice. Nothing new or unexpected; this is now the fifth consecutive
confirmation on this file. Worth recording that the shape #18's plan flagged
as unprecedented ("the doc precedent so far only covered schema-only modules,
not schema+service") was in fact already covered: `modules/judge/` from #19
shipped exactly that shape, and `modules/event-codes/` has it too. The
plan's caution was stale, not a real gap — the doc rule
(`guide/project-layout.md`: per-module files are "if present, must use the
locked suffix", not a mandatory five) has held for every combination this
repo has thrown at it.

**Metrics**: **zero** kata-docs MCP queries this task — searches, doc reads,
tokens: 0, against a task that spent its budget on drizzle/Postgres/zod
instead. That's the honest signal here: on a pure data-modeling task, kata's
surface area is small enough that the MCP server adds nothing, and the prior
entries on this file had already answered the one kata-shaped question
(module layout) ahead of time. `kata verify` itself stayed sub-second
(0.65s) inside a ~42s gate ladder — the ladder's cost is entirely vitest,
not kata.

**No kata friction to report**: no false positives, no dead ends, no
surprising output. The only nontrivial verification on this task was
database-shaped (partial unique index behavior, `ON DELETE set null` vs.
`restrict`), which kata neither helps nor hinders.

### Review-stage confirmation (PR #89)

`reviewing-tasks` re-ran the ladder on a clean worktree against a throwaway
Postgres: `kata verify --strict-coverage` → "no problems found (37 files
checked)", same as the implementation run. The schema+service-without-route
shape needs no further evidence — consider this question settled.

One thing `kata verify` does **not** see, and arguably shouldn't: the
migration creates the Postgres enum type `submission_case_status`, but no
column uses it (`case_results` is `jsonb`; the `pgEnum` exists only to
derive the TS union). `select count(*) ... from pg_attribute` confirms 0
columns reference it. That's a drizzle/Postgres modeling artifact, entirely
outside kata's remit — noting it here only to record that the boundary
felt right: kata checked module layout and stayed out of the data layer.

**Metrics**: 0 kata-docs MCP queries this review — searches, doc reads,
tokens: 0. Two consecutive stages (implement + review) on a data-modeling
task with zero kata-docs traffic is the clearest signal yet that the MCP
server's value is concentrated in route/DI/JWT-shaped work, not schema work.
`kata verify` cost ~0.7s of a ~40s ladder; the wall-clock was vitest and
`pnpm install`, never kata.

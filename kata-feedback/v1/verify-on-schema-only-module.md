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

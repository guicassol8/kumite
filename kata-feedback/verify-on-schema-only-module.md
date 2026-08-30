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

# Clean kata verify run on a NOT NULL + FK-restrict refactor

**Found while**: #32 — making `submissions.userId`/`teamId` mandatory
(NOT NULL, `onDelete: 'restrict'`), tightening the DTO, dropping now-dead
nullable branches in the service, and adding a route-level 404 guard.
**Where in kata**: `kata verify --strict-coverage`, the `defineRoute`
`output` map, `c.error`.

## What

No kata-docs MCP lookups were needed for this task. The only kata-specific
surface touched was adding a second `404` outcome to an existing route's
`output` map (`ErrorBodySchema` reused, discriminated by the `error` field
at runtime) — the pattern was copied straight from an existing sibling
route (`teams.route.ts`'s `not_in_team` 404) rather than looked up in docs,
and it typechecked and ran correctly on the first try.

`kata verify --strict-coverage` stayed green through every step: the
schema change (NOT NULL + FK `onDelete` swap), the DTO tightening, the
service simplification (dropping `identity.teamId === null` branches), and
the new route guard. No false positives, no need to silence or work around
anything.

## Why it matters

Confirms `kata verify`'s coverage checks don't choke on a route gaining a
second same-status (404) discriminated-by-body-field outcome reusing an
existing output schema — a pattern that could plausibly confuse a
static "does every declared output get produced" check. It didn't.

## Metrics

Zero kata-docs queries this session (0 tokens on doc round-trips). Task
total was mid-sized (schema + migration + DTO + service + route + unit
tests + hurl, ~9 files). The existing codebase's own sibling patterns
(`teams.route.ts`, `problems.route.ts`) were sufficient context — no doc
lookup would have paid for itself here.

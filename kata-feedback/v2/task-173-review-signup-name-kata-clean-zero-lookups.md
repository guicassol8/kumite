# Reviewing the signup-name column PR — kata clean again, zero MCP lookups

**Found while**: reviewing PR #173 (fixes #122 — `users.name` column,
required at signup, searchable in `/organizer/users`, surfaced across
teams/header/panel)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

Diff review (schemas gaining a `name` field, `c.error` paths unchanged,
services staying pure query builders) needed zero `kata-docs` lookups —
the change is additive columns/fields on existing kata-shaped
schemas/services, nothing that touches DI, JWT, or a new route. `kata
verify --strict-coverage` and the 15-file/306-request `hurl` suite both
passed clean on the first run against a freshly reset DB, matching the
PR's own test-plan claim exactly (no reproduction gap between what the
implementer reported and what review found).

## Why it matters

Same shape as the implementer's own entry for this PR
(`task-122-signup-name-column-verify-hurl-clean-zero-lookups.md`) and the
last few review-stage entries in this file: additive, schema-shaped
kumite changes keep costing zero kata-docs round-trips at both
implementation and review time. `kata verify` continues to be a strong,
fast correctness signal for this class of change — it would have caught
a missing `.schema.ts` field or a raw error throw immediately, but there
was nothing to catch here.

## Metrics

0 kata-docs queries. `pnpm verify`: <1s, 65 files, no findings. `pnpm hurl`
against a reset DB: 15/15 files, 306 requests, ~7.4s, no findings.
`pnpm -r test`: 40+579+464 passed, ~2 min wall time, no findings.
`pnpm -r typecheck`: clean. No kata friction encountered during review.

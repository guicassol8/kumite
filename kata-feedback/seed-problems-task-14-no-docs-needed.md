# Problem seed task (#14): zero kata-docs lookups, clean verify

**Found while**: #14 — seed 4 published problems (pt/es/en) via `back/src/db/seed.ts`
**Where in kata**: `kata verify --strict-coverage` only; no DI/JWT/route/error surface touched

## What

The task extended an existing `seed(db)` function to insert problem rows by
reusing the domain's own service functions (`createProblem`/`updateProblem`/
`publishProblem` from `problems.service.ts`) instead of raw inserts. No new
route, no new DI binding, no schema change — so there was no kata-specific
API to look up. Zero `kata-docs` MCP queries made this session.

`kata verify --strict-coverage` ran clean (`46 files checked`) on the first
try, both after the RED test commit and after the GREEN implementation
commit, with no findings to react to.

## Why it matters

Confirms the framework surface stays invisible for a task that is pure
domain-service composition (no route/DI/schema touched) — nothing to
report, but worth recording as a "clean, no-lookup" data point alongside
the other zero-lookup entries already in this folder
(`rounds-api-heavy-back-task-zero-docs-lookups.md`,
`round-detail-endpoint-no-docs-lookup.md`).

## Metrics

- kata-docs MCP queries: 0.
- `kata verify` invocations: 2 (both via the pre-commit hook), both clean,
  sub-second each.
- No extra turns spent chasing kata docs or framework behavior — all context
  came from reading the existing `problems.service.ts`/`problems.schema.ts`
  and the prior `seed.test.ts`.

# Reviewing #39/PR #112: kata surface was easy to verify, no docs needed

**Found while**: reviewing PR #112 (`getParticipantRoundRoute` + `getParticipantRound`).
**Where in kata**: `defineRoute` input/output schemas, `c.error`, DI (`c.get('db')`,
`c.get('currentUser')`), `kata verify --strict-coverage`.

## What

Reviewing the new route/service/schema trio didn't require a single
`kata-docs` lookup either — the diff's shape (schemas in `.schema.ts`,
`c.error('not_found', ..., { status: 404 })`, `use: [requireUser]`, DI via
`c.get`) was directly comparable against the sibling `getRoundRoute` /
`getParticipantProblemRoute` already in the same files, so correctness was a
side-by-side diff read, not a framework question. `kata verify
--strict-coverage` (46 files) and the full back suite (309 tests) both passed
clean on a fresh worktree DB with no coaxing.

## Why it matters

Second data point (the implementer's own `kata-feedback/` entry on this same
PR made the same observation from the authoring side) that additive,
idiomatic changes to an already-consistent kata module are cheap to both
write and review without touching the docs MCP. Reviewing here cost zero
kata-docs tokens and the only friction was environment plumbing (dedicated
worktree Postgres needed a full schema+drizzle-metadata wipe, not just a
table truncate, to get `db:migrate` to actually recreate tables after a
`DROP SCHEMA public CASCADE` — the `drizzle` metadata schema survives a
public-only drop and short-circuits future migrations).

## Metrics

- kata-docs queries this review: 0.
- Back-touching verification (`test`, `verify`, `hurl` against a rebuilt
  worktree DB) plus front `test`/`typecheck`/`format:check` plus one Playwright
  e2e run: all green, matching the PR's own claims exactly.

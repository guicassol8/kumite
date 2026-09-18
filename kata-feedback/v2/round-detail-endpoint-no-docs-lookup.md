# kata-docs wasn't needed to add a new participant route

**Found while**: #39 (participant round-detail screen + its
`GET /rounds/:id` endpoint)
**Where in kata**: `defineRoute`, `c.error`, DI via `c.get`/`defineContext`
— no specific file, just the everyday route-authoring surface.

## What

This task added a new route (`getParticipantRoundRoute` in
`rounds.route.ts`), a new service function with two small local queries,
and new Zod DTOs — a full round trip through kata's `defineRoute` /
`input`/`output` schema / `c.error` / DI (`c.get('db')`, `c.get('currentUser')`)
surface. I never queried the `kata-docs` MCP server once. The existing
sibling routes in the same file (`getRoundRoute`, `openRoundRoute`, etc.)
and the analogous participant read in `problems.route.ts`
(`getParticipantProblemRoute`) were complete, current, self-consistent
examples of every pattern needed: `use: [requireUser]`, the
`{ 200: Schema, 404: ErrorBodySchema }` output shape, `c.error('not_found',
..., { status: 404 })`, and `c.get('currentUser').id`. Copying and adapting
those was faster and more reliable than a docs lookup would have been,
and `kata verify --strict-coverage` (run automatically by the PostToolUse
hook after every edit, plus lefthook's pre-commit) caught nothing wrong
across ~4 back commits touching DI and route wiring.

## Why it matters

Not a gap in kata-docs — more a data point that for an **additive** change
to an already-established, idiomatic module (as opposed to learning a new
capability), a well-factored existing codebase is often a faster reference
than the docs MCP. The framework's own consistency (every route in this
file shaped the same way) is what made that possible; it's a mild argument
for kata-docs' own examples staying mirrored to real, current call sites
rather than needing an agent to reconcile the two.

## Metrics

- kata-docs queries this task: 0. Tokens spent on doc lookups: 0.
- `kata verify --strict-coverage` ran automatically many times (PostToolUse
  hook + every `git commit` via lefthook, ~4 back commits + several
  front-only commits that still triggered it). Every run passed clean, no
  false positives, adds maybe 1s per invocation — negligible overhead, and
  it never had to be argued with.
- The heavier cost in this task's back work was environment setup (a
  dedicated worktree Postgres, discovering that running the full vitest
  suite against the same DATABASE_URL used for `hurl`/dev leaves rounds in
  `open`/leftover states that then collide with `hurl`'s "only one round
  open" invariant) — unrelated to kata-docs, but worth flagging since it
  cost a full db reset + re-seed + re-run cycle. Not a kata bug per se
  (the hurl file's own header already warns about needing a fresh db
  between runs), but the collision surfaces specifically because tests and
  hurl share one Postgres by convention in this repo.

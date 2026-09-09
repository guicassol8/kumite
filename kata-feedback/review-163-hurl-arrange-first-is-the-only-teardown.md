# Arrange-first is the only teardown hurl has, and the suite still isn't rerunnable

**Found while**: kumite #163 (review of #161) — `db:seed` not resetting
`event_config`, and the hurl suite being coupled to glob order
**Where in kata**: hurl integration (`hurl --test --jobs 1 src/modules/*/*.hurl`)

## What

The implementation entry for this task
(`task-161-implementation-hurl-has-no-teardown.md`) reported that hurl has no
teardown hook, so "restore in the last step" only restores on green. Reviewing
the PR reproduced that from the outside and confirmed it exactly:

- With step 3 of `event-config.hurl` deliberately broken, hurl reported
  `10 request(s)` for that file out of the 12 it runs green. The two requests
  it skipped are step 4 and **step 5, the restore**. The failure output shows
  the row it walked away from: `{"mixingLocked":true,"maxTeamSize":5}`.
- `teams.hurl`, ten files later in glob order, passed 60/60 anyway — because
  the PR made it arrange its own state. Before this PR that same scenario is
  what turned into the misattributed `teams.hurl:111` failure quoted in #161.

So the fix works, but it works by making every consumer of shared state
defensive. There is no way to express "restore this regardless of outcome" in
a `.hurl` file, and nothing warns you when a file mutates event-wide state
without a downstream file arranging around it. The correctness of the suite
now rests on a convention a reviewer has to hold in their head.

A second, related observation: even fully green, the suite is not rerunnable.
`teams.hurl` creates `teams-e2e-*` users and fails its first signup on a
second run. Producing this review's evidence therefore needed a full
`truncate ... restart identity cascade` + `db:seed` between the two hurl
runs. Reset cost, not framework cost, but it is the dominant cost of
verifying anything hurl-shaped.

## Why it matters

Any kata consumer following the per-module `.hurl` layout against one shared
database inherits both properties: a failed file leaks its mutations to every
file after it, and files that create fixtures can't be rerun. The first
produces failures that point at the wrong module (the exact cost #161 was
opened to pay off); the second means every verification round-trip pays a
database reset.

## Metrics

- `kata-docs` MCP lookups during this review: **zero**. Consistent with the
  implementation entry — nothing in the diff (a drizzle `onConflictDoUpdate`,
  two `.hurl` files, one vitest file) touched a kata API whose shape was in
  question.
- `kata verify --strict-coverage`: clean, 61 files, no false positives, and
  nothing it could have been expected to catch here — glob-order coupling
  between `.hurl` files is outside what the rules model.
- Where the review's wall clock went: two full hurl runs (~6s and ~9s) were
  trivial; the `truncate` + `db:seed` reset between them, plus `pnpm -r test`
  (51s back, 22s front), dominated. Same shape the implementation reported.

## Suggested fix (optional)

Unchanged from the implementation entry: a teardown section that runs
regardless of outcome, or a `<module>.teardown.hurl` convention. Adding to it
from the review side — if that's out of scope, a `kata verify` rule (or just
a documented convention) that flags a `.hurl` file mutating shared state
without arranging it first would turn this from tribal knowledge into
something checkable.

# Task #50 (organizer team moderation): zero kata-docs lookups, hurl `count` trap reconfirmed

**Found while**: implementing-tasks for #50 (organizer team moderation API:
rename/move/remove member/remove team)
**Where in kata**: hurl assertions (`pnpm hurl`) — same surface as
`first-query-param-route-and-a-hurl-count-trap.md`

## What

1. **Zero kata-docs MCP queries this task, no rework.** Everything needed —
   `defineRoute` shape, the `requireUser`/`requireOrganizer` guard pair, the
   401/403-undeclared convention, the DrizzleQueryError `.cause` unwrap
   pattern for catching a unique-constraint race — was already present as a
   precedent elsewhere in the codebase (`problems.route.ts`,
   `rounds.service.ts`'s `openRound`). Reading existing sibling code was
   strictly faster and just as reliable as a docs round trip for this task's
   shape (four CRUD-ish organizer routes on an existing module, no new
   framework concept).

2. **The same hurl `count` filter-error trap from
   `first-query-param-route-and-a-hurl-count-trap.md`, hit independently.**
   Asserting "team no longer appears in the listing" as
   `jsonpath "$.teams[?(@.id=='{{team3_id}}')]" count == 0` fails with
   `Filter error: missing value to apply filter` (empty match ⇒ no value for
   `count` to consume), not a normal assertion failure. Also tried
   `== []` as a second guess — that fails too, with `invalid predicate
   value` (array literals aren't a valid predicate value). The working
   spelling, confirmed via `grep` over existing `.hurl` files rather than a
   docs lookup, is `not exists` (already used in `rounds.hurl` and
   `problems.hurl` for the identical "absent from a list" shape). Two failed
   guesses before finding the working precedent by grep — a docs mention
   would have saved both.

## Why it matters

This is now two independent tasks tripping on the exact same hurl footgun,
which is a decent signal that it is not a one-off. Grepping sibling `.hurl`
files for the working idiom was fast (one command) once tried, but it is not
the naturally-reached-for pattern (a jsonpath `count == 0` and an `== []`
both feel more natural than `not exists` at the point where the assertion is
being written).

## Metrics

- kata-docs MCP queries: 0. Task went from plan to green gate entirely by
  pattern-matching existing kumite code (not kata docs) — the framework
  itself introduced no new surface this task touched.
- Extra turns from the `count`/`== []` trap: 2 failed hurl runs before
  landing on `not exists` (found by grepping this repo's own `.hurl` files,
  not kata's docs).
- `kata verify --strict-coverage`: clean on every run across the whole task
  (52 files, well under 1s each time), including after adding 4 new routes
  with a shared `[requireUser, requireOrganizer]` guard chain — resolved
  correctly, zero false positives.

## Suggested fix (optional)

Same as the prior report: a one-line note in kata's hurl guidance —
"`count` errors (not fails) on an empty match; use `not exists` to assert
absence, and note `== []` is not a valid predicate value either" — would
have prevented both wrong guesses across two separate tasks.

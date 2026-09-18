# Task #51 (organizer team listing): zero kata-docs lookups, a second hurl empty-value trap

**Found while**: implementing-tasks for #51 (`GET /organizer/teams` — an
organizer-scoped, unanonymized team listing built on top of #50's mutation
routes)
**Where in kata**: hurl assertions (`pnpm hurl`) — same surface as
`task-50-organizer-moderation-hurl-count-trap-again.md` and
`first-query-param-route-and-a-hurl-count-trap.md`, but a different flavor
of the same underlying gotcha.

## What

1. **Zero kata-docs MCP queries again.** The new route (`listOrganizerTeams`
   service + `GET /organizer/teams` route + schema) was built entirely by
   mirroring an existing sibling in the same file: `listTeams`/`TeamsList`
   already had the exact join shape (teams left-joined to members
   left-joined to users) this needed, just unscoped and unanonymized. No
   new kata concept was touched — `defineRoute`, `requireUser`/
   `requireOrganizer`, DI via `c.get('db')` were all copy-paste-verified
   from `teams.route.ts` itself.

2. **A related but distinct hurl trap from the two reports above.** Those
   reports cover asserting *absence* (a row no longer appears in a list) —
   `count` errors on an empty *match*, fixed with `not exists`. This task
   hit the sibling case: asserting a *present* row's array **field** is
   empty (a team that exists but has zero members). The instinctive
   `jsonpath "$.teams[?(@.id=='{{id}}')].members" == []` fails immediately
   with `invalid predicate value` (array literals aren't valid hurl
   predicate values — confirmed by grepping this repo's own `.hurl` files
   for precedent, same move as the prior report). The fix, by analogy with
   the `count == 0` idiom already used elsewhere in this same file for
   `$.testCases`/`$.examples`-style fields, was:
   `jsonpath "$.teams[?(@.id=='{{id}}')].members" count == 0` — and it
   worked first try once framed as "count the field", not "compare to a
   literal empty array".

## Why it matters

Three tasks now (two prior + this one) have independently reached for an
array-literal or bare `count` on an empty *match* before landing on the
working idiom for "list is empty" in its various shapes. The pattern that
actually works — `count == 0` when a field is present-but-empty,
`not exists` when the row itself is absent — is discoverable by grep once
you know to look, but isn't the first instinct in either direction.

## Metrics

- kata-docs MCP queries: 0, same as #50 — the framework surface here was
  entirely precedented by sibling code in the same module.
- Extra turns from the `== []` guess: 1 failed hurl run before switching to
  `count == 0`, which then passed clean.
- `kata verify --strict-coverage`: clean on every run (56 files, sub-second),
  including after adding a new route sharing #50's
  `[requireUser, requireOrganizer]` guard chain.

## Suggested fix (optional)

Same ask as the prior two reports, extended: a one-line hurl note covering
both empty-list shapes together — "asserting a list is empty: `count == 0`
when the field/match is present but empty; `not exists` when the row itself
doesn't exist. `== []` is never a valid predicate value in either case." —
would resolve this whole family of guesses in one read instead of one
failed run per task.

# Review #133 (organizer team moderation): clean verify, one hurl DB-state snag (not kata's fault)

**Found while**: reviewing-tasks for PR #133 (`#51` — organizer team
moderation screen, back listing route + front CRUD UI)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

1. **Zero kata-docs MCP queries.** Reviewing the diff (new `.schema.ts`
   DTOs, a pure `listOrganizerTeams` service function, a thin `defineRoute`
   reusing `[requireUser, requireOrganizer]` from #50) didn't raise any
   question about kata's own behavior — the idioms were legible straight
   from the diff and its sibling routes in the same file.
2. `kata verify --strict-coverage` stayed clean through the review fix
   commit too (56 files, sub-second) — adding a status check + inline
   error state to two mutation handlers didn't trip anything.
3. The one snag was **not** a kata issue: this worktree's disposable
   Postgres (its own compose project, port 5439) had stale data from
   earlier implementation work in the same worktree, so `pnpm hurl` first
   failed on unrelated routes (`maxTeamSize` mismatch, organizer login
   `invalid_credentials`). A `docker compose down -v` + migrate + seed in
   this worktree only (confirmed with the user first, since it's a
   volume-destroying command) fixed it — 13/13 hurl files green afterward,
   260 requests. Worth flagging as a workflow gap: `reviewing-tasks` in
   `docs/workflow.md` doesn't mention resetting the worktree's own DB
   before running hurl, even though `implementing-tasks`/worktree docs
   already establish it's disposable.

## Why it matters

Another zero-lookup kata-adjacent task — reinforces that `defineRoute` /
DI / guard-chain composition is now internalizable from sibling code
without a docs round-trip, at least for organizer-moderation-shaped
routes. The hurl snag is a kumite workflow gap, not a kata one, but noting
it here since it cost a full clarifying question mid-review.

## Metrics

- kata-docs MCP queries: 0.
- Extra turns from the DB reset: 1 clarifying question (destructive-command
  block) + 1 down/up/migrate/seed cycle, ~2 minutes wall clock.
- `kata verify --strict-coverage`: clean before and after the review fix.

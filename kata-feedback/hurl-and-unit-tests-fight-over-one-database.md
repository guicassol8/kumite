# hurl has no reset story, and the unit tests silently eat its fixtures

**Found while**: #33 (teams screens — reshaped `GET /teams` into a viewer-scoped envelope)
**Where in kata**: `kata`'s hurl integration (`pnpm hurl`, `<domain>.hurl`), and how it
coexists with DB-backed unit tests

## What

Two separate false failures this task, both from the same cause: `pnpm hurl` and the
DB-backed unit tests share one database, and nothing in the hurl workflow resets or
isolates it.

1. Right after adding asserts for the new `mixingLocked` field, `teams.hurl` failed with
   `actual: boolean <true>, expected: boolean <false>`. The API was correct — the previous
   `vitest run` had left `event_config.mixingLocked = true` and a stray `Orphan` team behind,
   because `teams.test.ts` truncates and re-seeds those tables per test.
2. Later, the Playwright walkthrough's organizer step failed at login. Same root cause:
   the unit tests truncate `users`, which deletes the account `pnpm db:seed` created and the
   E2E spec logs in as.

Both cost a debugging round-trip to attribute to test-order rather than to the code under
test. The `.hurl` files already carry a hand-written "reset the db with `docker compose down
-v && …`" comment at the top, which is the tell: every consumer is expected to solve this
themselves, in prose, per file.

## Why it matters

`pnpm hurl` is presented as a first-class verification step alongside `kata verify` and
`pnpm test`, but it is the only one of the three that is order-dependent on the others.
The failure mode is the expensive kind: a red assert that points at the assertion instead
of at the environment, so the first instinct is to doubt the code that was just written.
It also makes the hurl suite awkward in CI right after a test job, and unreliable to run
twice in a row locally (the `.hurl` files' own comments admit this: signups collide on the
second run).

## Metrics

- **kata-docs calls this task: zero.** The back-side change (swapping a route's `output`
  from `z.array(TeamSummarySchema)` to a named object schema, adding a viewer argument to
  the service) was fully determined by existing patterns in the repo, so there was nothing
  to look up. No tokens spent, none needed — recording this as the "smooth" data point.
- **`kata verify --strict-coverage`: 8 runs, all green, ~0.6s each.** Zero friction, zero
  false positives, including on the reshaped route. Cheap enough that the pre-commit hook
  running it every time is invisible.
- **Cost of the DB-sharing issue: ~2 extra debug cycles** (one hurl failure, one Playwright
  failure), maybe 10 minutes and 3–4 tool round-trips, on a ~13-step task. That is the
  single largest piece of avoidable friction in the whole task.

## Positive observation, unprompted

Replacing the list route's array output with an object envelope propagated to the front
purely through `hc<AppType>` — `pnpm -r typecheck` was the only step needed to prove the
contract still held, with no codegen and no hand-written types. That is exactly what the
typed-client story promises, and it held under a breaking-shape change, not just an
additive one.

## Suggested fix (optional)

Something in kata that lets a `.hurl` file declare its own preconditions, so the reset
stops being a prose comment each consumer re-implements. Cheapest useful version: a
documented `pnpm hurl` recipe that resets and re-seeds first (a `pretest`-style hook), or a
per-file `# @requires-clean-db` marker that `kata` honours by running the project's
configured reset command before the file.

---

## Confirmed independently during the #33 review (PR #91)

Same finding, reached from the other side. Reviewing this PR meant running `pnpm hurl`
and the Playwright walkthrough for real, and neither is runnable against the shared dev
database while other agents' worktrees are live: `back`'s vitest truncates `users`,
`teams`, `event_config` and `event_codes`, so any hurl or E2E run that follows it starts
from a database that no longer contains what `db:seed` put there.

What the review actually had to do before a single assert could run:

1. `docker run` a throwaway Postgres on a free port (5437 — 5432 through 5436 were
   already taken by five other worktrees' databases on this machine).
2. Write `back/.env` + `front/.env` pointing at it, on non-default HTTP ports.
3. `db:migrate` + `db:seed`.
4. Run `pnpm -r test` — which truncates the tables again.
5. `truncate ... cascade` + `db:seed` **a second time**, then boot the server, then hurl.
6. Truncate + re-seed **a third time** so the walkthrough's "no teams exist yet"
   screenshot had an empty `teams` table to photograph.

Three manual resets for one review pass. Every one of them is a step a reviewer has to
know about from prose (the `.hurl` header comments, plus the note the author left in the
PR body) rather than from the tooling.

## Why the review angle matters

The author hits this once and works around it. The reviewer hits it *every time*, on a
cold worktree, with no memory of the workarounds — and the failure still presents as a
red assert pointing at the code under review. That is the worst possible place for this
class of error: it costs reviewer trust in a diff that is actually correct.

It also means "evidence" in this repo's workflow is only reproducible if the reviewer
independently reinvents DB isolation. Nothing in `pnpm hurl` or the Playwright config
hints that a shared database will silently invalidate the run.

## Metrics (review pass)

- **kata-docs calls: zero.** Reviewing the reshaped route (`output:` swapped from an array
  schema to an object envelope, service gaining a viewer argument) needed no kata lookups —
  the diff was self-explanatory against the repo's existing module pattern. Second
  consecutive "smooth, nothing to ask" data point on this task.
- **`kata verify --strict-coverage`: green, 37 files, ~1s.** No false positives on the
  reshaped route or the new `JoinBlockedReasonSchema` enum.
- **Environment setup vs. actual reviewing: roughly 8 tool round-trips on DB/port/env
  plumbing, against ~12 spent reading and judging the diff.** Close to 40% of the review's
  mechanical effort went to working around the shared-database problem, not to the review.

## Strengthened suggestion

The author's suggestion (a `@requires-clean-db` marker, or a documented reset recipe kata
runs before hurl) would fix the reviewer case too, and is worth more than it looks: it is
not just convenience, it is what makes a `pnpm hurl` result mean the same thing for the
author and the reviewer.

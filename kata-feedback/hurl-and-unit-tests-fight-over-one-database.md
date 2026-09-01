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

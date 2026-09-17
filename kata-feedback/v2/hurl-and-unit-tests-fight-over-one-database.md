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

---

## Third occurrence, implementing #27 (organizer role guard)

Same shape again, this time entirely self-inflicted by following this task's own gate
ladder in the documented order (`pnpm format` → `typecheck` → `verify` → `pnpm -r test`,
*then* the hurl/e2e obligations). `back`'s `pnpm -r test` truncates `users` (among other
tables) as part of the new `auth-guards.test.ts` suite's own `beforeEach` — so every time
the gate ladder ran to completion, the seeded organizer account it had just created via
`pnpm db:seed` was gone again, and the next hurl or Playwright run needed a fresh
`db:seed` first. This happened three separate times in one implementation session: once
before the first hurl run, once before the front e2e spec run, and once more for the
final gate-ladder pass before opening the PR — caught each time only because `curl
.../health` plus a manual `select email, role from users` habit was already in place from
reading this very file's earlier entries.

One new wrinkle worth recording: the *front* Playwright evidence (`organizer-problems.spec.ts`)
is not just order-sensitive but content-sensitive to leftover rows. Running the hurl suite
(which creates several throwaway problems) before the e2e walkthrough left extra rows in
`problems`, and the list-screenshot evidence PNGs came back 25–30% larger with visibly
different content (more table rows) than the previously committed evidence — silently,
with no failing assertion, since the spec only checks for specific testids, not an exact
row count. A truncate-and-reseed immediately before the Playwright run fixed it. This is a
sharper version of the same root cause: shared-database order-dependence doesn't only
produce red asserts, it can also produce **green but wrong** evidence that a reviewer
would have no reason to distrust.

## Metrics (this occurrence)

- **kata-docs calls this task: 2** (`search_docs` + one `read_doc` on `guide/jwt.md` for
  `requireRole`/`guard` — see `jwt-docs-worth-the-tokens.md`). Both aimed at the guard API
  itself, not at this DB-sharing problem — kata-docs has no content on cross-suite DB
  isolation, so there was nothing to look up here even if I'd thought to try.
- **Extra `db:seed` invocations caused purely by this issue: 3**, plus one full
  `truncate ... cascade` to force a clean slate before the final evidence-quality e2e run.
  Rough cost: 4-5 tool round-trips and a few minutes, small relative to the ~40-tool-call
  implementation but entirely avoidable overhead, and the kind of thing a first-time
  implementer would very plausibly miss (silently wrong evidence, not a loud failure).

## Reinforced suggestion

Both prior entries' suggestion stands. Adding to it from this occurrence specifically: if
kata (or this repo's own tooling) can't own DB isolation between hurl/e2e and vitest, even
a documented "reset + reseed immediately before capturing evidence, every time, no
exceptions" checklist step in `implementing-tasks`/`reviewing-tasks` would have caught the
oversized-screenshot case before it reached a commit, rather than relying on the
implementer noticing a `git diff --stat` byte-count anomaly.

---

## Fourth occurrence, implementing #43 (ranking service + API)

Same root cause, new failure shape: a *false negative* in the hurl output that briefly
looked like a real ranking bug. After writing `ranking.hurl` (3 fresh teams, one that
never submits, asserting `$.teams count == 3` on `GET /rounds/{{round_id}}/ranking`), the
first `pnpm hurl` run against this task's own throwaway Postgres (port 5434, spun up
specifically for this worktree to avoid the shared compose db on 5433) came back with 5
teams instead of 3 — two of them named
"Time A" / "Time B", the exact fixture names `rounds.test.ts` and `submissions.test.ts`
use. A `pnpm --filter @kumite/back test` full run had been executed (for the gate ladder)
*before* `pnpm hurl`, on the very same DB — each test's `beforeEach` truncates, but nothing
truncates after the *last* test, so whatever the final test inserted survives into the
next tool that reads the database.

Worse, a second real bug showed up disguised as the same class of noise: `getEventRanking`
correctly summed *two* closed rounds (this file's own round plus `problems.hurl`'s
"Problems E2E Round", since `pnpm hurl` runs every `*.hurl` file against one shared
server/db in filename order, and `problems` sorts before `ranking`), but the hurl
assertion had hard-coded `$.teams[0].rounds count == 1`. Full DB reset made the count-3
symptom disappear, which briefly suggested the second failure was pollution too — it
wasn't; it was the assertion wrongly assuming this file's round was the only one in the
event. The fix was to switch to a `rounds[?(@.roundId=='{{round_id}}')]` jsonpath filter,
the same defensive pattern `rounds.hurl` already uses for its own participant-list
assertions — a pattern this task would have reached for immediately if the DB-pollution
noise hadn't been present at the same time to blur which failure was which.

## Metrics (this occurrence)

- **kata-docs calls this task: zero.** The module (new `ranking.schema.ts` /
  `.service.ts` / `.route.ts` / `.hurl`) followed the existing `rounds`/`submissions`
  module shape exactly (`defineRoute`, `requireUser`-only guard, `ErrorBodySchema`,
  DB truncate-per-test pattern) — every question was answered by reading a sibling
  module, not by querying kata-docs.
- **`kata verify --strict-coverage`: every run green, ~46 files, well under 1s each.**
  Zero false positives across 4 commits (schema, pure core, DB assembly, routes).
- **Cost of the DB-sharing issue this time: 2 full container-recreate cycles** (`docker rm
  -f` + `docker run` + `db:migrate` + `db:seed` + restart the app process, since the old
  `postgres-js` pool had cached connections to the just-removed container) plus one hurl
  assertion rewrite — roughly 10 tool round-trips. Distinct from the first three
  occurrences: this time the pollution symptom (extra teams) and a genuine test-authoring
  bug (the hard-coded round count) surfaced in the *same* failing run, which cost extra
  time to tell apart before concluding only one of the two was actually the DB-sharing
  issue.

## Reinforced suggestion, again

Every occurrence so far has been solved by throwing away and rebuilding the database —
never by a tool telling the implementer *which* rows are stale. A cheap, purely-additive
version of the standing suggestion: `kata verify` or `pnpm hurl` printing a one-line
warning when a table it's about to assert against contains rows the current `.hurl` run
didn't itself create (e.g., a row count taken before the file's first request, diffed
against a fresh reset) would have turned this occurrence's "why are there 5 teams"
confusion into an immediate, correct diagnosis instead of a full reset-and-retry.

---

## Fifth occurrence, implementing #45 (leaderboard screen) — different blast radius

This one is the same mechanism as every prior entry, but a materially worse outcome: the
task's own approved plan stated up front that it was "100% front-end... nenhuma mudança
de schema, migração ou `.hurl` é necessária," so no dedicated throwaway DB was set up
before starting. `back/.env` was copied from `.env.example` as-is to satisfy the
`JWT_SECRET` requirement in `config.ts`, which left `DATABASE_URL` pointing at its
documented default — `postgres://kumite:kumite@localhost:5433/kumite`, the docker-compose
service this repo's own worktree conventions call "shared across worktrees, do not run
tests against it" (this is written down as project memory precisely *because* of that
convention, yet the front-only framing of this task's plan was enough to skip acting on
it). The pre-commit hook's `pnpm test` step then ran `back`'s DB-backed suite — which
truncates `users`, `teams`, `rounds`, `event_config`, etc. per test, same as every prior
occurrence — against that shared instance, on at least two real commits, before a manual
browser-verification step (checking the new SSE-driven grid actually renders, which
`vitest`/jsdom cannot exercise) surfaced the mistake by needing its own live Postgres.

The distinction from occurrences 1-4 worth naming explicitly: those were all
**self-inflicted** — an implementer's own seed data or E2E fixtures getting truncated by
their own later test run, on their own throwaway or long-lived dev database. This one had
the *other* agents on the shared `5433` instance as the blast radius: two `pnpm test`
runs against the default `DATABASE_URL`, before the mistake was caught, means any
concurrently-running worktree's in-progress dev data (accounts, teams, rounds, problems)
was liable to be wiped mid-task, for a reason that has nothing to do with the diff being
authored. The plan's own accurate claim ("front-only, no back changes") is exactly what
made this easy to miss: "this task doesn't touch the database" and "this task's tooling
is safe to run against the shared database" are different claims, and only the second one
determines whether `pnpm test`/`kata verify --strict-coverage` are safe to run at all in
this repo's multi-worktree setup. Every kumite task runs the pre-commit ladder on every
commit regardless of what it touches, so this risk is present on literally every task,
not just DB-shaped ones.

Caught by luck, not by tooling: the manual-verification need (this task needed a real
running back+SSE stream to see the grid) happened to force a dedicated Postgres container
into existence, and a "wait, what port is `DATABASE_URL` actually pointing at" check
before wiring up that container is what surfaced the earlier commits' mistake. A
purely-front task that never needs to eyeball a live server (most of them, per the other
front-task entries in this file) would have no such trigger and would run `pnpm test`
against the shared DB for the task's entire duration without ever finding out.

## Metrics (this occurrence)

- **kata-docs calls this task: zero.** Every schema mirrored in the front (ranking event
  shapes, connection-status callback) came from reading `back/src/modules/ranking/` and
  `sse/` directly — a genuinely front-only task in the sense the plan meant, which is
  exactly why DB isolation didn't come to mind until forced by manual verification.
- **`kata verify --strict-coverage`: every run green** (46 files, back untouched by this
  task's diff) — consistent with every other front-only entry in this file: cheap,
  correct, no false positives from a diff that never touches `back/src`.
  `pnpm -r test`, in the same ladder, is what carried the risk.
- **Estimated blast radius before the mistake was caught: 2 pre-commit `pnpm test` runs**
  against the shared `5433` Postgres, each one truncating and never repopulating
  `users`/`teams`/`rounds`/`event_config`/etc. No confirmed casualty this time (no other
  agent reported lost work), but nothing in the tooling would have surfaced it if there
  had been one — same "green but wrong, silently" shape the third occurrence's oversized
  screenshots already demonstrated, just aimed outward at other sessions instead of
  inward at one's own fixtures.
- **Recovery cost once caught:** one throwaway Postgres container (`docker run
  postgres:17-alpine` on a free port), `db:migrate` + `db:seed`, and re-running the full
  gate ladder against it (~1 min) to confirm the earlier green runs were still
  legitimately green once isolated — call it 5-6 tool round-trips, small compared to the
  unbounded downside of what the first two runs could have destroyed elsewhere.

## Sharpened suggestion

The standing per-file/per-run suggestions (a `@requires-clean-db` marker, a stale-row
warning) all assume the person running the suite already knows to be worried. This
occurrence argues for a stronger default specifically for the *unbounded blast-radius*
case: `back`'s DB-backed test setup refusing to run (loud error, not a silent pass) when
`DATABASE_URL` resolves to the project's documented shared/default host+port without an
explicit opt-in (e.g. a `ALLOW_SHARED_TEST_DB=1` escape hatch for the rare case it's
actually wanted). A destructive suite defaulting to "safe unless told otherwise" would
have turned this task's silent risk into an immediate, correct refusal on the very first
`pnpm test` invocation — before any commit, before any truncation, regardless of whether
the implementer (or their plan) correctly believed the task itself was front-only.

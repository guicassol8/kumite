# kata verify stayed free; the hook ladder around it destroyed the E2E fixtures twice

**Found while**: #13 (organizer problem form — front only, `back/` untouched),
implementation and the review-fix round on PR #92
**Where in kata**: `kata verify --strict-coverage` (clean); the pre-commit /
Stop hook ladder that wraps it (the actual friction)

## What

Two separate observations from one front-only task.

**1. `kata verify` cost nothing and said nothing false.** It ran on all 8
commits of this task via the pre-commit hook, always green
("no problems found (37 files checked)"), on a diff that is 100% `front/`
sources, i18n JSON and Playwright PNGs. Zero `kata-docs` MCP queries were
needed during implementation — the one genuinely kata-shaped question
(does the error envelope carry structured issues, or only `message`?) had
already been answered by `guide/errors.md` at *planning* time, and that
answer held: `POST /:id/publish`'s 400 really does name the missing
locales only inside `message`, so the front pre-validates client-side and
shows the API string verbatim as a fallback. The doc paid for itself once,
in the previous session, and cost nothing in this one.

**2. The `pnpm -r test` step of the same hook silently wiped the E2E
organizer account — twice.** This is an independent reproduction of
`hurl-and-unit-tests-fight-over-one-database.md` § observation 2, from a
task that shares none of its code. Sequence:

1. `pnpm db:seed` → `admin@kumite.dev` exists; both organizer Playwright
   specs pass.
2. `git commit` → the pre-commit ladder runs `pnpm -r test`, whose back
   suite truncates `users`.
3. The next `pnpm --filter @kumite/front e2e` fails 6 specs, all at
   `expect(getByTestId('header-user-email'))` — a login timeout that
   points at the front, not at the vanished fixture.

Each occurrence cost a full 30s-per-spec timeout run (~2–3.5 min of
wall clock) plus a `psql` round-trip to diagnose, and it recurs every time
a commit lands between seeding and running the browser suite — which, in
a TDD loop that commits per step, is *most* of the time.

## Why it matters

Observation 1 confirms `kata verify` is genuinely free on non-back work:
no false positives from i18n JSON or binary screenshots, ~0.6s of a ~43s
ladder. Nothing to fix there — recording it as the negative result it is.

Observation 2 is the one worth acting on, and its recurrence in an
unrelated task suggests it is not a #33 quirk but the steady state: the
back's DB-backed unit tests and the seeded E2E fixtures occupy the same
database with no isolation, and the failure surfaces at the greatest
possible distance from its cause (a browser assertion in a *different*
package, minutes later). Any kata consumer that pairs DB-backed module
tests with a seeded browser suite will hit this on their first commit.

## Metrics

- `kata-docs` MCP queries this session: **0** (0 tokens). The framework's
  API surface never came up during implementation; the planning-session
  lookup was sufficient and accurate.
- `kata verify --strict-coverage`: 8 runs, ~0.6s each, 37 files checked,
  always green — **~1.4%** of the ~43s hook ladder it sits in.
- `pnpm -r test` in the same ladder: ~33s per commit (~77% of it), and the
  step that caused both false E2E failures.
- Debugging cost of observation 2: 2 full-suite Playwright runs that
  failed for a reason unrelated to the code under test (~6 min wall clock)
  plus 2 diagnostic `psql` queries, before the cause was attributed.

## Suggested fix (optional)

For observation 2, anything that makes the destruction visible would have
saved the whole debugging loop — e.g. having the DB-backed test helper
that truncates `users` re-insert the `ORGANIZER_EMAIL` account afterwards
when that env var is set, or having `kata`'s test harness expose a
per-suite schema/transaction so truncation never escapes the suite. A
one-line warning from the truncating helper ("truncated `users`; re-run
`pnpm db:seed` before the browser suite") would be a cheap 80% of the
value.

## Update — the review-fix round (PR #92, 3 findings)

Third occurrence, and the first one that cost nothing: the fix round for
the review's three findings is again 100% `front/`, and both points above
held.

- `kata verify`: 4 more runs (3 commits' pre-commit ladder + one manual
  `pnpm verify`), all green, `no problems found (37 files checked)`,
  **0.6s of a 43s ladder** — same ~1.4% share.
- `kata-docs` MCP queries: **0** again. Three sessions on this task
  (planning, implementing, fixing) have now needed exactly one kata-docs
  answer, all the way back in planning.
- Observation 2 did not bite this time **only because it was already
  written down**: the ladder truncated `users` again (three commits, three
  `pnpm -r test` runs, plus one standalone), and re-seeding *before* the browser suite was a
  deliberate step taken on the strength of this file and the warning it
  put in the PR body. Cost of the workaround: one `db:seed` command.
  Cost without it, measured twice in the previous session: ~3 minutes of
  Playwright timeouts pointing at the wrong package.

That's the shape of the problem worth recording: the trap is now fully
documented on the kumite side and still fires on every single commit —
each session pays a small tax forever, and any session that forgets pays
the full ~3 minutes. It is a fixture-lifecycle gap, not a knowledge gap.

## Update — #7 (problem screen ↔ API integration), a fourth independent hit

Fourth reproduction, and the first on a task whose E2E suites depend on
*organizer-seeded* fixtures created fresh per spec run (not one seeded
account reused across a whole session) — the blast radius turned out
bigger than "re-run `db:seed`".

- `kata verify`: every commit (7 total, all `front/` — no back code touched
  at all for #7), always green, same negligible share of the ladder.
- `kata-docs` MCP queries: **0**. No back schema questions arose because
  #11/#21 had already shipped everything the front needed; this is now the
  fourth `front/`-only task in a row to need zero lookups.
- The truncation hit differently here: this task uses a dedicated
  per-worktree Postgres (not the shared dev DB `db:seed` targets), and each
  of the 7 commits' pre-commit `pnpm -r test` truncated it via the back
  suite's `beforeEach`. `users` sat at 0 rows by the end of the session.
  Re-seeding the organizer account was cheap (`pnpm db:seed`), but the
  bigger cost was every *E2E-created* fixture — published problems, rounds,
  team memberships, participant accounts — vanishing with it. Three
  separate debugging detours during this task turned out to be nothing but
  a round left `open` by state a previous truncation (or a manually killed
  Playwright run) never got to close, which then blocked every subsequent
  run's own `POST /organizer/rounds/:id/open` (409, silently ignored by the
  spec's fire-and-forget `fetch`) — cascading into unrelated-looking
  failures ("Problema não encontrado", a stuck "Aguardando a próxima
  rodada.") that cost roughly 20+ minutes total to trace back to one open
  round each time, across four separate incidents.

## Why it matters (addendum)

The original suggested fix (re-insert the seeded organizer after
truncation) would not have prevented this task's actual time sink: the
expensive failures were never "the organizer is gone", they were "a round
another test session opened is still open, and every open-round check
after it fails for a reason several layers removed from the real cause."
A DB-backed E2E suite that creates its *own* rounds per run needs either
(a) each spec's own crash-safety — closing what it opened even when a
later assertion in the same test fails, not just on the happy path, or
(b) the app itself refusing to treat "one open round system-wide" as a
silent 409 a fire-and-forget test fetch can ignore. Neither is a kata gap
specifically, but the truncation trap in this file is exactly what
produces the orphaned-open-round state in the first place: a suite killed
mid-run by an unrelated `pnpm -r test` truncation event has no chance to
run its own cleanup.

## Metrics (addendum)

- Time lost to the "stray open round" cascade across this task: ~20-25
  minutes across 4 occurrences, each initially misdiagnosed as a product
  regression before the actual cause (an open round from a previous/killed
  run) was found via direct `psql`/API inspection.
- Every occurrence was resolved by one manual
  `POST /organizer/rounds/:id/close` call — cheap once identified, expensive
  to identify from the front-end symptom alone.
## Update — a new symptom of the same root cause (#46, dedicated throwaway DB)

Fourth occurrence, on a task following the "spin up your own disposable
Postgres per worktree" convention specifically to dodge the shared-db
version of this trap — and it still bit, in a new shape.

Sequence: fresh `docker run postgres:17-alpine` on a free port →
`db:migrate` → `db:seed` (organizer only, no rounds) → pre-commit ladders
for three front-only commits (each running `pnpm -r test`, back included)
→ started the `#45`/`#46` Playwright leaderboard spec against that same
throwaway db. First assertion failure: `leaderboard-empty-no-round` never
appeared — the "Geral" tab instead showed a real column header **"Round
1"** with a live score row. Not a wiped fixture this time but a *planted*
one: `back/src/modules/rounds/rounds.test.ts` and
`back/src/modules/sse/sse.test.ts` both insert literal `name: 'Round 1'`
rows directly via Drizzle, and at least one such row survived to the end
of the back suite's run (no final teardown truncate, or a later test's
`insert` racing a truncate — didn't dig further) instead of test isolation
cleaning it up per-test. The E2E spec's precondition comment ("no round
already open in the shared dev db") wasn't wrong about *itself* — it just
didn't anticipate `pnpm -r test` running against the *same* fresh db
in between seeding and the browser run, same as observation 2 above.

Fix applied here: `docker rm -f` the throwaway container and redo
migrate+seed immediately before the Playwright run, every time, treating
any intervening `pnpm -r test` as db-dirtying. Confirms the suggested fix
in observation 2 generalizes beyond `users`/`ORGANIZER_EMAIL`: any
DB-backed back unit test that inserts fixture rows without full teardown
is a landmine for whatever E2E run shares its database, worktree-local or
not. Per-worktree throwaway databases sidestep cross-*worktree*
contamination but not cross-*command* contamination within the same
worktree session.

### Metrics

- Cost of this occurrence: one full Playwright run to the first failing
  assertion (~30s timeout) plus reading its error-context snapshot to spot
  the phantom "Round 1" column — ~1 minute total, cheaper than the
  `users`-wipe case because the symptom (an unexpected column header) was
  visible directly in the failure's accessibility snapshot, no `psql`
  round-trip needed.
- `kata-docs` MCP queries this task: **0** — same pattern as every prior
  front-only entry here; this task never needed the framework's API
  surface, only its test/DB behavior, which isn't kata-docs-covered ground
  anyway.
- `kata verify --strict-coverage`: 5 runs across the task's commits, all
  green, no false positives from the route/hook/i18n/e2e-spec diff.

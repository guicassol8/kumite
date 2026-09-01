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

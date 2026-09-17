# The gate ladder gets OOM-killed before it gets a chance to fail honestly

**Found while**: reviewing PR #140 (#54, organizer panel overview — new `stats`
back module + the front screen).
**Where in kata**: `kata verify`, the `hurl` script, and the gate ladder the
repo's pre-commit hook drives around them.

## What

Three observations from the review side of a task whose implementation side
already filed `task-54-new-module-zero-docs-lookups-and-hurl-reset-cost.md`.
The first is new; the second corroborates that entry from a different angle;
the third is a plain "this was clean".

**1. The full gate ladder is not survivable on a small machine, and it fails
opaquely.** Committing a one-file test change ran the pre-commit hook's
`pnpm -r test` (three vitest instances: blocks, back, front). On a 7.1 GB
machine with ~1.5 GB actually available — two VSCode windows were holding
~5 GB — the hook was **OOM-killed: exit 137, no message, no failing test,
nothing to act on**. The editor itself crashed in the same window.

The failure is indistinguishable from a hang or an interrupted session. There
is no "out of memory" line, no partial report; `git log` afterwards is the
only way to learn whether the commit landed (it hadn't — the change was still
staged, so nothing was lost, but that had to be checked rather than known).

Two runs earlier the same suite had produced a *different* symptom from the
same cause: two timeout-shaped failures (`Unable to find an element by:
[data-testid=...]` after 3s) in two unrelated files, one of which passed in
isolation seconds later. So under memory pressure the ladder degrades first
into phantom test failures, then into a silent kill.

Setting `VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=1
VITEST_MIN_FORKS=1` made the identical commit pass the full ladder, green,
twice in a row. That is a workaround an agent can only apply once it has
correctly guessed the cause.

Worth noting this is the *same class* of problem the repo already solved for
Playwright: `front/playwright.config.ts` pins `workers: 2` with a comment
explaining that the default outgrows a small machine and that the symptom is
"a different spec fails every run, with no error to show for it". Vitest under
the hook has no equivalent guard.

**2. The hurl reset tax, reproduced independently.** First `pnpm hurl` of the
review: 2 of 14 files red — `teams.hurl` asserting `maxTeamSize == 3` against
an actual `6` and `slotsAvailable == 2` against `5`. Same root cause as the
implementation-side entry: leftover state from the previous run's own hurl
execution, not the diff. After a truncate-all + `db:seed`, all 14 files passed
with zero code changes.

Two review-specific notes on top of that entry:

- A **truncate of every non-migration table + `db:seed` is sufficient**; the
  full `docker compose down -v` isn't needed. That matters because `down -v`
  is exactly the kind of destructive command an agent harness may refuse
  (mine did), leaving the documented recovery path blocked while the cheaper
  one works fine.
- The misleading-failure point in that entry is worth doubling: as a
  *reviewer* the pull toward "the PR broke teams.hurl" is strong, because
  reviewing is precisely the activity of suspecting the diff. The two red
  files were in a module #140 never touches, which was the only tell.

**3. Verify stayed clean on a brand-new module.** `kata verify
--strict-coverage` was green on all 59 files on every invocation across the
review (2 manual + 2 pre-commit hooks), and had nothing to say about the new
`stats` module — schema in `.schema.ts`, `defineRoute` with
`use: [requireUser, requireOrganizer]`, undeclared 401/403 per ADR-0011, pure
service. The `.hurl` coverage check passed on the 401/403/200 trio. No
false positives.

## Why it matters

The gate ladder's job is to convert "something is wrong" into "this specific
thing is wrong". Both failure modes here break that contract in the same
direction — they produce red that has nothing to do with the change under
test — and both hit hardest in a fresh review chat, where the reviewer has no
memory of the machine's state and every incentive to blame the diff.

The OOM case is the worse of the two because it produces no output at all.
An agent that doesn't check `git log` after an exit 137 could plausibly
re-run, re-stage, or conclude the hook rejected its work.

## Metrics

- kata-docs MCP queries this review: **0**. The diff was judged against
  neighbouring modules (`event-config`, `ranking`, `rounds`); the kata idioms
  in question (`defineRoute` shape, ADR-0011's undeclared middleware errors,
  `.hurl` coverage) were all legible from them. Consistent with the
  implementation side's 0.
- `kata verify --strict-coverage`: 4 invocations, all green, ~0.7s each,
  59 files. Zero false positives, zero findings.
- `pnpm hurl`: run 1 — 14 files, 217 requests, 4.7s, **2 failed** (stale DB).
  Run 2 after truncate + seed — 14 files, 266 requests, 4.7s, **14/14 green**.
  Reset cost ~10s (truncate + seed) versus the ~25s `down -v` cycle.
- Gate ladder wall-clock: ~1m20s per pre-commit at default parallelism (when
  it survives); noticeably slower single-threaded, but it completed both times.
- Cost of the OOM: one lost commit attempt, one editor crash, one session
  resume, plus ~4 turns to diagnose (check `git log`, check `free -h`, check
  process RSS) before the single-thread workaround.

## Suggested fix (optional)

Nothing kata-side is strictly required — this is mostly a harness/host-resources
story. But if `kata verify` or a kata-provided test runner ever fronts the
ladder, the cheap wins mirror what Playwright already does here: cap worker
count by *available* memory rather than core count, and emit one line naming
memory when a child dies on signal 9, so exit 137 arrives with a sentence
attached instead of silence.

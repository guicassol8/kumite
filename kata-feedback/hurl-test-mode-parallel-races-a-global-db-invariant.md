# `hurl --test`'s default parallel execution races a global DB invariant across files

**Found while**: #37 (submission round lock + participant read gating — the first task
where more than one `.hurl` file manipulates the rounds API)
**Where in kata**: not kata's own code, but the `pnpm hurl` recipe kata's docs/scaffold
point projects at (`hurl --test ... src/modules/*/*.hurl`)

## What

`hurl --test` runs the given files in parallel by default (`--parallel` is implied by
`--test`; `--jobs 1` is the only way to disable it). That's invisible right up until two
`.hurl` files touch the same cross-file, DB-level invariant — which is exactly what
happened here: `rounds.hurl`, `problems.hurl` and `submissions.hurl` all now create and
open a round, and `rounds_single_open_idx` (a partial unique index) allows only **one**
`status = 'open'` row across the whole `rounds` table, event-wide, by design.

Running `pnpm hurl` against a fresh db intermittently failed with
`{"error":"another_round_open"}` on whichever file's `POST .../open` lost the race — not
on every run, and not always the same file, which made it look like a flaky/rare bug in
my new code the first two times I hit it. It reproduced 100% of the time once I looked at
it as a parallelism question instead: two files opening a round within the same
few-hundred-ms window will always collide, because the invariant is real product state
(the organizer runs one round at a time), not test fixture noise.

Confirmed via `hurl --help`: `--parallel` — "Run files in parallel (default in test
mode)"; `--jobs <NUM>` — "Maximum number of parallel jobs, 1 to disable parallel
execution". There's no per-file "needs exclusive access to X" annotation, and no
documented convention for it.

## Why it matters

Before this task, only `rounds.hurl` touched the rounds API, so the race was latent —
nothing else contended for the same global row. Any kata-based project with a genuine
singleton/global invariant (single open round, single active session, a leader-election
row, a "only one thing is X at a time" partial unique index — a common enough pattern)
will hit this the moment a second `.hurl` file starts exercising that same subsystem,
and the failure mode is the worst kind: it looks exactly like a real 409 the code under
test produced, on a file that has nothing wrong with it, and it doesn't reproduce
reliably enough to be obviously "just" a race on first sight.

This is the same family as `hurl-and-unit-tests-fight-over-one-database.md` (hurl and
vitest sharing one DB with no reset story) but a distinct mechanism: that one is about
*sequential* runs stepping on each other's fixtures; this one is about hurl's *own*
default concurrency stepping on a global invariant even when nothing outside hurl is
running at all.

## Metrics

- **kata-docs calls this task: zero.** Every change (round-access helpers, the
  participant-read gate, the submission lock, the schema/route wiring) was fully
  determined by existing patterns already in the repo (`reapExpiredRound`,
  `getBestSubmission`, the `SubmitOutcome` discriminated union, the route `switch`
  exhaustiveness trick) — nothing kata-specific needed looking up. Recording as another
  "smooth, nothing to ask" data point, this time in a back task heavy enough to touch
  three modules and two `.hurl` files.
- **`kata verify --strict-coverage`: every run green** (43 files, ~0.7s each), no false
  positives across the new round-access branches or the submission pipeline's added
  early-return.
- **Cost of the race, once identified**: two full docker-container-reset cycles
  (~1 minute each) spent reproducing it cleanly before trusting it was a race and not a
  logic bug, plus the fix itself (one line: `--jobs 1` in `back/package.json`'s `hurl`
  script, plus closing the round `rounds.hurl` was leaving open at the end, which was a
  second, independent contributor to the same symptom). Maybe 10 minutes total — small,
  but it's exactly the kind of thing that would have shipped as CI flakiness rather than
  a local finding on a task that touched fewer modules at once.

## Suggested fix (optional)

Nothing kata needs to change necessarily — `--jobs 1` is a complete, one-line fix once you
know to reach for it. What would help: kata's own docs/scaffold for the `hurl` script
(wherever it's templated for new projects) could default to `--jobs 1`, or at least call
out in a comment that `--test` parallelizes by default and that any project with a
global/singleton DB invariant exercised by more than one `.hurl` file should pin
`--jobs 1` proactively rather than discovering the race the way this task did.

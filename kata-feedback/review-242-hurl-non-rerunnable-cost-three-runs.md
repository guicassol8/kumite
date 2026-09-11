# hurl's non-re-runnability cost three full suite runs to diagnose

**Found while**: reviewing PR #242 (issue #181 — blocks generator guards)
**Where in kata**: `hurl` integration (the `kata`-blessed `--test` workflow),
not `kata verify`

## What

The PR adds one hurl case (`submissions.hurl`, a 400 `disabled_block`). Proving
it green took three full runs of the suite, because a hurl run mutates the
database and the server's in-memory state, and nothing in the tooling says so:

1. **Run 1** — fresh DB, fresh server. 4 files failed. `submissions.hurl` died
   on `another_round_open` (409): `rounds.hurl` runs earlier in the glob and
   leaves the single global open-round slot taken.
2. **Run 2** — same DB, same server. *Worse*: 9 files failed at request #1,
   because `password-reset.hurl` had already rotated the organizer password, so
   every subsequent login failed. A second run is not just flaky, it is
   systematically more broken than the first.
3. **Run 3** — `TRUNCATE` + `db:seed` + **server restart**. 15/15 green, 309
   requests. The restart was load-bearing on its own: after truncate-only,
   `bug-reports.hurl` still failed with `bug_report_throttled`, a throttle held
   in the server process, not in a table.

So the real precondition for a green hurl suite is "fresh database **and** fresh
server process" — and only the first half of that is even guessable from the
outside.

## Why it matters

`pnpm --filter @kumite/back hurl` is one of the two mandatory evidence artifacts
for every back-touching PR in this repo. Its failure mode is actively
misleading: the output names an application error (`another_round_open`,
`bug_report_throttled`, a 401 on login) that reads exactly like a regression in
the PR under review. A reviewer's correct first conclusion from run 1 is "this
PR broke rounds", which is wrong.

The cost is paid per review, by every agent, forever, and it is paid in the
most expensive place — the moment you are deciding whether to trust a diff.

## Metrics

- kata-docs MCP: **0 queries**. Nothing in this review needed it — the diff is
  Blockly codegen plus two lines of zod enum. Same reading as the
  implementation-side entry for this task.
- `kata verify --strict-coverage`: **3 runs, ~0.8s each**, clean every time,
  including after the two fixes this review pushed. It correctly stayed quiet
  about `blocks/` (outside its surface) and correctly stayed quiet about the new
  `CodegenErrorCodeSchema` members.
- hurl: **3 suite runs + 1 single-file verbose run**, ~7s each, of which **2
  runs (~50% of the hurl time) were pure diagnosis of the harness**, not of the
  PR.
- The one kata-adjacent thing that genuinely worked: adding a code to
  `BlocksErrorCode` breaks `Record<BlocksErrorCode, CodegenErrorCode>` at
  typecheck, which is exactly the intended tripwire. That is plain TS, not kata
  — worth noting because it is the mechanism kata's error surface leans on.

## Suggested fix (optional)

Nothing here is a kata *bug* — the suite is order-dependent because the app has
genuinely global state (one open round, one organizer, an in-process throttle).
What kata could offer:

- A documented "hurl needs a clean slate" story: a `kata hurl --reset` hook, or
  simply a line in the hurl docs stating that `--test` assumes a pristine
  database *and* process, so consumers stop rediscovering it one review at a
  time.
- Failing that, a way to declare per-file preconditions/teardown inside a
  `.hurl` file (the absence of teardown was already reported from task #161) —
  `rounds.hurl` closing the round it opened would have made run 1 green.

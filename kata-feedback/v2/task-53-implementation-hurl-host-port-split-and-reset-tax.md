# hurl's host variable and the app's PORT are two knobs for one fact

**Found while**: implementing #53 (remove the organizer-triggered password
reset, add public `POST /auth/request-password-reset`, build
`/organizer/users`) — the implementation half of the task whose planning half
is recorded in `task-53-planning-route-removal-zero-docs-lookups.md`.

**Where in kata**: hurl integration (`--variable host=${HURL_HOST:-...}` in
`back/package.json`), `kata verify`.

## What

Three observations, one of them actionable.

**1. `HURL_HOST` and `PORT` are separate knobs for the same fact (friction).**
kumite's hurl script is
`hurl --variable host=${HURL_HOST:-http://localhost:3000} ...`, while the
server reads `PORT`. In a worktree those must agree, but nothing makes them:
`back/.env` had `PORT=3053`, so the server listened on 3053 and hurl still
dialled 3000, failing all 14 files with `Failed to connect` at request 1 —
an error that reads like a dead server, not a misconfiguration. The fix is
to pass `HURL_HOST` too, which is easy once you know, and invisible until
then. Note the wrinkle: `PORT` in `back/.env` is picked up by the server
process, but the hurl script's shell doesn't read that file, so the two
sources aren't even the same mechanism.

**2. The hurl suite still isn't re-runnable (recurring, already known).**
Ran it three times this session:

- run 1 (DB carrying earlier state): 12/14 pass — `teams.hurl` failing on
  `maxTeamSize == 3` vs actual `6`, because an earlier `event-config.hurl`
  run had mutated the singleton row and nothing put it back;
- run 2 (immediately after): 2/14 pass — signup collisions on fixtures the
  previous run inserted, so nearly every file died at its first request;
- run 3 (after `TRUNCATE ... RESTART IDENTITY CASCADE` + `db:seed`): **14/14,
  263 requests, 5.7s**.

So the suite is green and fast, but only from a clean database, and the
failure mode when it isn't is loud but misleading — `maxTeamSize` assertions
and signup 409s point at the specs rather than at the state. This is the same
shape as `hurl-and-unit-tests-fight-over-one-database.md` and the reset cost
in `task-54-...`; recording the concrete numbers rather than a new complaint.

**3. `kata verify` remains cheap and quiet.** 0.66–0.94s over 59 files on
every commit in this task, no false positives, including across a route
*deletion* (`resetUserPasswordRoute` plus its orphaned `NoContentSchema`).
The plan predicted `tsc` would catch the orphan and it did — verify didn't
need to.

## Why it matters

(1) is the only thing worth changing. Worktrees are the house rule in this
repo (`AGENTS.md` § Conventions: always work in a dedicated worktree, override
the ports), so *every* parallel task hits a port that isn't 3000 — and the one
command that doesn't follow `PORT` is the one whose failure looks like an
outage. Any kata consumer running more than one checkout will meet this.

(2) is not kata's bug so much as an unclaimed responsibility: kata ships the
hurl runner but leaves "what state do these files assume" to the consumer,
and consumers keep rediscovering that the answer is "a freshly seeded one."

## Metrics

- kata-docs MCP queries: **0**. Docs read: **0**. Same as this task's planning
  half, and for the same reason — every kata surface touched here
  (`defineRoute` deletion, a public route, hurl, `kata verify`) already had a
  worked example in kumite's own source to copy.
- Turns lost to the `HURL_HOST`/`PORT` split: **2** (one all-red run, one
  diagnosis). Turns lost to the dirty-DB reruns: **3**.
- `kata verify`: 5 runs, 0.66–0.94s each, 0 findings, 0 false positives.
- Honest caveat on totals: this session was interrupted twice by editor
  crashes and resumed, so a whole-session token figure would be fiction. The
  per-item turn counts above are the reliable part.

## Suggested fix

For (1): default hurl's host to the same variable the server reads, e.g.
`--variable host=${HURL_HOST:-http://localhost:${PORT:-3000}}`. One env var
then configures both, and the worktree case works with no extra knowledge.
Cheap, and it removes the misleading-outage failure mode entirely.

For (2): nothing proposed here — the recurring reports are the signal; whether
kata should own a "reset fixtures" step or just document the precondition is a
design call for a human.

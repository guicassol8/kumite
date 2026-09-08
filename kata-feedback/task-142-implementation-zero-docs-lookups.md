# Implementing #142: zero kata-docs lookups, and one route surface that helped

**Found while**: implementing-tasks for #142 (rate limit + timing parity on
the two public password-reset routes)
**Where in kata**: `kata verify`, `RouteContext.raw`, the hurl runner

## What

An implementation session that touched kata's surfaces the whole way through
and needed the docs exactly zero times. Three observations, none of them a
bug.

**1. `c.raw` was the right escape hatch, and it was obvious.** The task needed
the caller's IP, which kata does not expose (reported separately in
`no-rate-limit-middleware-or-client-ip-helper.md`, from this issue's planning
session). Reaching `getConnInfo(c.raw)` was a two-minute job because `c.raw`
is already used elsewhere in kumite (`request-logger.ts`, `sse.route.ts`) and
its type is plainly the Hono `Context`. The gap is real, but the workaround
is cheap and typed, which is the difference between a missing feature and a
blocker. Whatever kata decides about a first-class `clientIp`, keeping `raw`
as an unapologetic full-fidelity escape hatch is the thing that made this
task boring instead of a fight.

**2. `kata verify` stayed silent through five commits, correctly.** The work
added one lib module, one table, four config values, and changed two route
handlers' service calls. `kata verify --strict-coverage` ran on every commit
(pre-commit) and after every edit (PostToolUse hook) and found nothing, which
is the right answer — nothing here violated a route/DI/schema rule. Worth
recording as a non-event: the hook fires ~30 times a session at <1s and never
once produced a false positive to work around. Both routes' `input`/`output`
schemas were untouched, so there was nothing for it to catch; a session where
the linter has nothing to say is the expected case, not a sign it is idle.

**3. The hurl suite is still not re-runnable, and that is still the single
biggest friction in this workflow.** `pnpm hurl` passed 14/14 on a clean
database and then failed 12/14 on the immediately following run — every file
dying on its first request, because the signups it performs already exist.
The recovery is a full truncate-all + re-seed between runs. This is a kumite
authoring pattern as much as a kata one (the `.hurl` files choose fixed
addresses), but the runner is where it would be cheapest to fix, and it costs
a couple of turns every single time someone touches a route.

## Why it matters

Points 1 and 2 are the useful kind of signal for a framework: the parts that
did not need attention. The escape hatch meant an unsupported requirement
(read the client IP, correctly, behind a proxy) cost one small module instead
of a workaround against the framework.

Point 3 is the one with a real price. Every back task that adds a route pays
the same tax: run hurl, watch it fail on stale state, remember the reset
incantation, run it again. It is documented in the `.hurl` header comments,
which is exactly where you read it *after* wasting the run.

## Metrics

- **kata-docs MCP lookups: 0.** The server was not connected in this session
  either — sixth consecutive session, consistent with
  `kata-docs-mcp-connect-timeout-during-planning.md`. Nothing in the task
  needed it: the planning session had already answered the two framework
  questions from the installed `.d.ts`, and the implementation was ordinary
  service/route work against kumite's own patterns.
- **Cost of the gap, this session: ~0 tokens.** The lookup cost was paid in
  planning; implementation just followed the plan.
- **`kata verify`:** ~0.7–0.9s per run, 5 pre-commit runs plus the PostToolUse
  hook. 0 findings, 0 false positives, 0 turns spent working around it.
- **Full pre-commit ladder:** ~76–81s per commit (format 0.4s, typecheck ~15s,
  kata verify ~0.8s, tests ~63s), 5 commits ≈ 6.5 minutes of the session. The
  tests dominate, not kata.
- **hurl:** 2 wasted runs (~2 turns, ~5s each) before resetting the database;
  the clean run was 267 requests in 4.9s across 14 files. The 14th file is
  this task's, extended to 12 requests.

## Suggested fix (optional)

Only for point 3, and only if the runner is the right place: a per-file
`# [Setup]`-style hook, or a documented `--reset-command` the runner invokes
before the suite, would let a `.hurl` file declare "I need a clean database"
once instead of every author rediscovering it. Failing that, the cheapest
real improvement is a `pnpm hurl:clean` script in kumite that truncates and
re-seeds first — kumite's own to write, but worth flagging that every kata
consumer with a signup route will land here.

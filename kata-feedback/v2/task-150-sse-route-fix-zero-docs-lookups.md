# A `streamSSE` route fix, and zero kata-docs lookups to make it

**Found while**: #150 (e2e suite not re-runnable — a failing spec left a round open)
**Where in kata**: `kata verify`, `defineRoute` + `hono/streaming`, the lefthook
gate ladder that runs `kata verify --strict-coverage`

## What

The task started as front-only (Playwright fixtures) and ended up touching one
back route: `back/src/modules/sse/sse.route.ts` subscribed to the in-memory bus
only *after* awaiting and writing the initial `state.sync` and `ranking.updated`
frames, so anything published in that window reached nobody. Fix was to
subscribe first and buffer until the snapshot is out.

Three plain observations, no bug in kata itself:

1. **`kata verify` had nothing to say about it, correctly.** The defect was a
   concurrency ordering bug inside the handler body — not a route contract, not
   a DI resolution, not a schema. `verify` stayed green before and after, which
   is the right answer; noting it only because it marks the boundary of what
   the tool covers.
2. **The `output: {}` escape hatch on this route is still load-bearing.** The
   existing comment in `sse.route.ts` explains that `200` is deliberately
   undeclared because kata's `raw()` output contract validates via
   `response.clone().text()` in strict mode, which would hang forever on a
   heartbeat stream that never closes. That's already logged in this folder as
   a framework gap (no per-route `outputValidation` override). This task
   reconfirms it: I edited that handler substantially and the workaround had to
   stay exactly as-is. Nothing new, just a second data point that the gap has a
   real cost — the route's response is untyped for `hc<AppType>` consumers.
3. **Editing a `streamSSE` handler is invisible to every kata surface.** Route
   registration, DI (`c.get('sseBus')`, `c.get('db')`) and the schema files were
   untouched, so the whole change lived in a region kata neither validates nor
   documents. Writing the regression test meant reading kata's behavior off the
   existing `sse.test.ts` (which already had a hand-written comment about
   `writeSSE`'s promise resolving a tick before the handler's continuation
   runs — a subtlety nobody documented, discovered the hard way by whoever
   wrote that test).

## Why it matters

Nothing blocked. Point 2 is the only one with a suggested action, and it is
already filed. Points 1 and 3 are boundary markers: the highest-risk code in
this module (an async handler holding a long-lived stream and a subscription)
is exactly the part with no framework support — no lint rule, no contract, no
doc — while the parts kata does cover were never where the bug was.

## Metrics

- **kata-docs MCP lookups this task: zero.** Not a dead end, not a timeout —
  the question never came up. The work was Playwright fixtures, a React
  `useEffect`, and one `hono/streaming` handler; the one kata-shaped question
  (why is `output` empty here?) was already answered by a comment in the file.
  Compare with `task-53-planning-route-removal-zero-docs-lookups.md`: second
  task in a row where reading the kumite source beat asking the framework.
- **`kata verify` runs**: ~10 (every pre-commit, 9 commits). Consistently
  ~0.7–1.8s over 60 files. Never blocked, never false-positived. Its cost in
  the gate ladder is a rounding error next to `pnpm -r test` (~65–90s), which
  is what actually paced the session.
- **Gate ladder friction**: real, but not kata's. `pnpm -r test` truncates the
  worktree database on every commit, so each of the 9 commits forced a
  `db:seed` before e2e could run again. That is a kumite fixture problem, not a
  framework one — recording it because it is the single largest per-commit tax
  in this repo's loop.

## Suggested fix

None for kata. Point 2's fix (a per-route `outputValidation` override, or
strict mode skipping body validation on a streamed response) is already
described in `c-json-has-no-headers-either-and-verify-lets-adhoc-errors-through.md`
and the `sse.route.ts` comment.

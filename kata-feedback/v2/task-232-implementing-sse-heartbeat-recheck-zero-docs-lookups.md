# SSE mid-stream deactivation fix: zero kata-docs lookups, verify blind to the streaming path

**Found while**: implementing #232 (deactivated user keeps receiving SSE events until reconnect)
**Where in kata**: `defineRoute`'s `output: {}` escape hatch, `kata verify --strict-coverage`

## What

The fix only touches `sse.route.ts`/`sse.service.ts` — a plain async
subscribe callback plus a DB lookup already used elsewhere
(`findUserById`, the same helper `requireUser` calls). No new kata
concept was involved (no new middleware, no new DI key, no schema
question), so the kata-docs MCP was never queried this session.

`kata verify --strict-coverage` passed clean both before and after the
change, same as the earlier SSE task (`task-150-sse-route-fix-zero-docs-lookups.md`)
and the route's own header comment already on record here
(`raw-output-infinite-stream-strict-hang.md`): the route's `output: {}` is
an intentional escape hatch because kata's `raw()` output validation would
hang forever against a stream that never closes on its own. Adding a
second place that can end that stream (deactivation, not just client abort)
didn't change any of that — verify has no visibility into the streaming
handler's internal state machine either way, so it can't confirm or deny
this specific fix; the new integration test in `sse.test.ts` is the only
thing that actually exercises "stream closes after the account is
deactivated."

## Why it matters

Consistent with prior SSE-module feedback: this is a framework blind spot
(unobservable long-lived stream state) rather than a new finding, so this
entry is a data point, not a fix request. Confirms the workaround
documented in the route file continues to be the right call as the route
grows more logic.

## Metrics

- kata-docs MCP queries: 0 (nothing kata-specific to look up).
- `kata verify --strict-coverage`: 1 run, clean, ~1s.
- Full gate ladder (format → typecheck → verify → test): all green on the
  first pass after implementation; no kata-caused friction.

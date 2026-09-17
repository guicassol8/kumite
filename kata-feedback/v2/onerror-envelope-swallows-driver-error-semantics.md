# app.onError's unified envelope hides the difference between "our error" and "an uncaught driver exception"

**Found while**: reviewing #100 / #36 (organizer rounds API)
**Where in kata**: `app.onError` fallback, unified error envelope (ADR-0008)

## What

Reviewing `openRound` in `rounds.service.ts`, I reproduced a real TOCTOU race:
the handler does a friendly `SELECT ... WHERE status = 'open'` check before
opening a round, then a plain `UPDATE`. The DB has a partial unique index
(`rounds_single_open_idx`) as the real invariant. Under genuine concurrent
opens on two different draft rounds (verified with two independent
`postgres-js` connections, 5/5 runs), the second call's app-level check
passes (no open round yet), then its `UPDATE` throws a Postgres unique-
violation error that nothing in `rounds.service.ts` catches.

That exception reaches `app.onError` and comes back as kata's standard error
envelope rather than crashing the process — so the framework's fallback did
its job. But the envelope it produces is a generic one, indistinguishable
from any other uncaught exception, not the app's own `another_round_open`
(409) that every other path through this same function returns. A client
can't tell "you lost a race" from "the server broke."

## Why it matters

For a kata consumer, `onError` catching everything is the right safety net,
but it means a driver-level constraint violation and a genuine bug look
identical on the wire. The existing kumite convention for this exact
class of problem (`teams.service.ts`'s `createTeam`, `onConflictDoNothing()`
+ branch on whether a row came back) turns the same race into a clean
typed result instead of relying on `onError`. `rounds.service.ts` doesn't
follow that convention for `openRound`, so the race falls through to the
generic envelope instead. Not a kata bug — kata's fallback behaved exactly
as documented — but worth flagging because a consumer with a partial unique
index and a check-then-act service function has no signal from kata that
the DB, not their own logic, is the actual source of truth for the
invariant, until they hit exactly this gap.

## Suggested fix

None for kata itself. Filed as a "request changes" item on kumite PR #100
suggesting `openRound` adopt the same `onConflictDoNothing`-style pattern
already used in `teams.service.ts`.

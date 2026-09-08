# kata's automatic 422 validation envelope has no type on the `hc` client, even on routes with a declared error map

**Found while**: #49 (front-only screen for `/organizer/event-config`, consuming
the already-merged #48 API)
**Where in kata**: `@katajs-framework/core`'s `readInputs`/`buildRouteOnComplete`
(`dist/index.js`) — the automatic `422 validation_failed` envelope thrown
before a route's handler runs when `input` schemas fail.

## What

A route's `output` map only ever describes its *handler's* possible
responses. kata's own automatic input-validation failure (`422
validation_failed`, ADR-0011) is thrown earlier, outside the handler, and
is never added to that map — so it's invisible to `hc<AppType>`'s inferred
response type on the front, even for a route whose map already lists other
error statuses.

Concretely: `event-codes.route.ts`'s PATCH declares
`output: { 200: EventCodeSchema, 404: ErrorBodySchema, 409: ErrorBodySchema }`.
On the front, `res.status` is typed as the literal union `200 | 404 | 409`.
After narrowing out all three declared branches in an `if/else if` chain,
TypeScript narrows the remaining `res` to `never` — but the framework can
and does return a fourth status (422) at runtime, so that "impossible"
branch is exactly where the real validation-failure body shows up. Calling
`.json()` on the never-typed `res` compiles today (property access on
`never` is permitted), but it's fragile and easy to trip into a real
`TS2367` ("no overlap") if you instead compare `res.status === 422`
directly — which is what the natural-looking code would do.

For `event-config.route.ts`'s PATCH the gap is worse: its `output` is a
bare `EventConfigSchema` (no map at all), so the *only* declared status is
`200`. There is no way to express "and also possibly 422" for that route on
the client at all — even though it's a mutation whose body (`maxTeamSize`
must be a positive int) can legitimately fail validation.

I worked around it with a small helper that takes the response as
`unknown` before touching `.json()`, sidestepping the `never`-narrowing
entirely:

```ts
async function readErrorBody(res: unknown) {
  return (await (res as Response).json().catch(() => null)) as ApiErrorBody | null
}
```

and branching only on `else` (never on `res.status === 422` directly) to
reach it.

## Why it matters

Every kumite mutation route that has *any* validated input (which is
nearly all of them) can produce this envelope, but nothing in the type
system nudges a front author toward handling it — the "happy path only"
code typechecks cleanly and silently drops the 422 body on the floor
(generic fetch failure, no field-level error) until someone manually hits
it. The plan for this issue was written by a human against the same
mental model and got the status wrong too (said "400", real code is `422`
per `event-config.hurl` line 89 / `event-codes.hurl` line 105) — a symptom
of the same gap: nothing routes an author back to the real contract short
of reading the framework's own dist output or its hurl files.

## Metrics

No `kata-docs` MCP round-trips this task — the server wasn't reachable/listed
as a tool in this session, so I went straight to grepping
`@katajs-framework/core`'s compiled `dist/index.js` (`readInputs`,
`buildRouteOnComplete`, `formatZodIssues`) to confirm the exact status code,
error shape (`{error, message, issues: Record<string, FieldIssue[]>}`) and
`path` dot-notation format. That took maybe 10-15 minutes of an ~2h
front-only task — cheap, but only because the compiled output was legible;
a docs lookup (had one been available) that stated "automatic validation
failures are 422 and never appear in `output`" would have saved that
detour entirely and would have caught the plan's own "400" mistake before
implementation.

## Suggested fix (optional)

Either (a) have kata auto-augment every route's declared `output`/client
type with the `422 validation_failed` (and malformed-JSON `400`) shapes it
can always produce, so `hc`'s type reflects reality, or (b) if that's not
feasible generically, document this gap explicitly in the framework docs
(and ideally kata-docs) with the exact recommended client-side pattern
(read the body via `unknown`/`Response`, don't compare `res.status`
against the undeclared code) so front authors don't rediscover it per task.

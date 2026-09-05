# RPC client can't type an undeclared status (e.g. the automatic 422 envelope)

**Found while**: #28 (front signup/login screens + session/route guards)
**Where in kata**: RPC client typing for `output` (status-map and single-schema forms); the automatic `422` validation envelope kata injects when a route's `input` schema rejects a request.

## What

A route's `output` map only types the statuses it declares (e.g.
`{ 201: PublicUserSchema, 400: ErrorBodySchema }` for `/auth/signup`).
Kata's own automatic `422` validation-failure envelope — which fires
whenever the request body fails the route's `input` schema, per
`auth.hurl`'s own step 5 — is real at runtime but has no representation
in that type. On the client, once you've narrowed away every declared
status (`if (res.status === 201) {...}`, `if (res.status === 400) {...}`),
TypeScript narrows the remaining `res` to `never`, so `res.json()` on the
"anything else" branch is a compile error.

The front's signup screen needs exactly this branch defensively (client-
side zod should pre-empt a 422, but the back is the source of truth, so
the UI still maps `issues.body[].path` to a field error if one arrives).
The only way to keep the branch typed was an explicit cast:

```ts
const res = signupRes as unknown as { json: () => Promise<unknown> }
const body = (await res.json().catch(() => null)) as { issues?: ... } | null
```

Same shape of problem for `/me`, which declares a **single** `output`
schema (`PublicUserSchema`, no map) — the docs confirm a single schema is
sugar for `{ 200: entry }` on the *server* validation side (ADR-0024), but
client-side the RPC type still only has the one branch, so a real 401
from `requireUser`'s middleware also has to be read past a `never`-narrowed
response.

## Why it matters

Every kumite screen that has to defensively handle "the framework's own
built-in error path, which I didn't declare" ends up writing the same
`as unknown as {...}` escape hatch. It's not wrong, just repeated
boilerplate with no framework-sanctioned shape — a small helper (even
just an exported type like `KataUndeclaredResponse` or a documented
pattern) would remove the need to reinvent it per call site, and would
make the "the wrong schema behind an error status silently breaks that
error" danger callout in errors.md a little less sharp-edged, since right
now the *safe* path (declare 422) means hand-writing `ErrorBodySchema`
behind every input-validated route just to get a typed branch for a
status the framework already guarantees it can emit.

## Metrics

Two `kata-docs` searches + two doc reads (`guide/rpc-client.md`'s
"Multi-status responses" and "Extracting the types directly" sections,
plus `guide/errors.md`'s "Returned responses and the output schema")
resolved this in one round-trip — cheap relative to the task (this was a
small fraction of a ~13-step front task) and it directly prevented a
wrong guess: my first instinct was that `res.status === 422` would just
narrow like any other literal, and the docs (specifically ADR-0024's
"structural-typing caveat") is what surfaced that undeclared statuses
pass through unvalidated and untyped, which is what led to the cast
instead of a doomed comparison against a literal with no overlap.

## Suggested fix (optional)

A documented idiom (or a small exported helper) for "read a `Response`
whose status might not be in my declared union" — even just a paragraph
in `guide/errors.md` next to the existing danger callout, showing the
`as unknown as { json: () => Promise<unknown> }` (or a cleaner sanctioned
equivalent) as the intended escape hatch, would save every consumer from
re-deriving it.

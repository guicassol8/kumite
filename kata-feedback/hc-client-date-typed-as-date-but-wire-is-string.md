# `hc<AppType>` types coerced-date output fields as `Date`, but the wire value is a string

**Found while**: #40 (home screen consuming `GET /rounds`, a `z.coerce.date()`-typed
`RoundSummarySchema` output already used by the existing organizer rounds routes)
**Where in kata**: the `AppType`/`hc<AppType>` type generation path — whatever infers
a route's typed client response shape from its `output` Zod schema

## What

`rounds.schema.ts` uses `z.coerce.date()` for `openedAt`/`closesAt`/`closedAt`
(with a comment explaining why: kata re-validates the output *after* JSON
serialization, where a `Date` has already become an ISO string, so `date()`
alone would fail that re-validation). That's the right call for the
route's own output validation.

But the front's typed RPC client (`hc<AppType>`) infers those same fields as
`Date` in `InferResponseType`/the resolved `.json()` type — i.e. the
*schema's parsed output type*, not the *wire type* the client actually
receives. At runtime, `res.json()` on the front never runs the value back
through the zod schema (there's no client-side parsing step at all), so the
field is genuinely a plain ISO string, not a `Date` instance. Calling
`.getTime()` or handing it to `Intl.DateTimeFormat().format()` throws
(`RangeError: Invalid time value` for the latter — `ToNumber` on a
non-numeric string is `NaN`), even though `tsc` sees no problem at all.

The SSE channel in this same repo (`sse.schema.ts`) doesn't hit this: the
front hand-rolls its own zod parse (`SseEventSchema.safeParse(JSON.parse(...))`)
since that channel is outside `hc<AppType>` by construction, so coercion
genuinely happens there. Every *typed-client* consumer of a coerced-date
field doesn't get that safety net.

## Why it matters

This is a silent type-lie: the compiler gives full confidence that a field
is a `Date`, and the failure only shows up at runtime, on whatever code path
first calls a `Date`-only method on it — in this task, a `RangeError` deep
inside `Intl.DateTimeFormat().format()` when rendering a closed round's
timestamp. Nothing about the type signature at the call site hints that a
`new Date(value)` re-wrap is needed first. Any kumite screen consuming a
coerced-date field from the typed client (and there are several — rounds,
problems, submissions all have createdAt/updatedAt-shaped fields) is exposed
to the same footgun, and the fix (re-wrap with `new Date(...)` at the
consuming end) is invisible from the schema or the generated type alone —
it's tribal knowledge unless someone hits the crash first.

## Metrics

Zero `kata-docs` MCP lookups this whole task (~13 implementation steps
spanning a new back route/service/test/hurl scenario plus six new front
files and one existing-route extension) — every kata idiom needed
(`defineRoute`, `use:`, `output:` multi-status objects, `c.error`, DI via
`c.get`) was already established in sibling modules, so reading those was
faster and more reliable than a doc round-trip would have been. The one
genuine unknown this task hit — whether `publishProblem` requires all three
locale translations — also wasn't looked up in docs; it surfaced as a
runtime 400 (`incomplete_translations`) during e2e debugging and was fixed
by matching the existing `problems.hurl`/`organizer-problems.spec.ts`
pattern. In both cases, kata-docs simply wasn't reached for; existing
sibling code was consistently the faster path.

## Suggested fix

Either (a) have the `AppType`/client-response inference use a distinct
"wire type" for `z.coerce.date()` fields (i.e. `string`, matching what
`.json()` actually returns) instead of the schema's parsed-output `Date`, or
(b) document the gap prominently wherever coerced dates are covered, so
consumers know every such field needs `new Date(value)` before use despite
the `Date` type shown by `tsc`.

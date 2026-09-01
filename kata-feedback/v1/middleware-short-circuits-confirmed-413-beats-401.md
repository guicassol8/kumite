# Middleware short-circuits behave as ADR-0011 promises — confirmed empirically (413 beats 401, envelope intact, `--strict-coverage` fine with both undeclared)

**Found while**: reviewing #93 / #21 (rota de submissão: codegen → sandbox →
pontuação → veredito)
**Where in kata**: `@katajs-framework/core` 0.4.2 — `bodyLimit` (ADR-0011),
`requireUser`-style middleware short-circuits, `kata verify --strict-coverage`

## What

Mostly a **"this worked"** entry, recorded because the implementing session had
to take ADR-0011 on faith and a reviewer could actually test it.

`POST /submissions` mounts `use: [bodyLimit({ maxSize: 262144 }), requireUser]`
and deliberately does **not** declare `413` or `401` in its `output` map, on
ADR-0011's grounds that middleware short-circuits are not validated against
`output`. Three things were worth verifying rather than assuming:

1. **The undeclared statuses still come back in the standard envelope.** A
   300128-byte body returned exactly:
   ```
   HTTP 413
   {"error":"payload_too_large","message":"Request body exceeds the maximum allowed size"}
   ```
   Same `{error, message}` shape as a hand-written `c.error` — nothing about it
   reads as "escaped the framework".

2. **Ordering is the intuitive one: `bodyLimit` beats `requireUser`.** The same
   oversized body with **no** `Authorization` header still returned `413`, not
   `401` — kata runs `use` in array order and the first short-circuit wins, so
   the expensive auth work never happens on a body that was going to be
   rejected anyway. This is the desirable order for an anti-abuse endpoint and
   it falls out of the array, but it is not spelled out anywhere I found; a
   reader could reasonably assume auth is special-cased to run first.

3. **`kata verify --strict-coverage` is content with the omission** — clean on
   38 files, no "undeclared status" warning for a route that provably emits two
   statuses absent from `output`. Consistent with ADR-0011, and worth stating
   out loud since the neighbouring rule `no-adhoc-error-shape` does police
   error shapes.

The **flip side** is already on file: `undeclared-status-client-typing-gap.md`
(from #28) documents that the RPC client narrows an undeclared status to
`never`. So the server side of this route is idiomatic and verify-clean, and
the front task that consumes it (#7) will need the `as unknown as {...}` escape
hatch for exactly these `413`/`429` branches. Server-side correctness and
client-side typability are pulling in opposite directions here, and a route
author currently gets no hint of that at the point where they decide to leave a
status undeclared.

## Why it matters

The "should I declare a middleware status in `output`?" question came up in
#21's planning, cost a kata-docs round-trip to answer, and the answer was
counter-intuitive enough that the implementer left a code comment citing the
ADR by number. Confirming it empirically means the next kumite route can copy
the pattern without re-litigating it — but the cost is now deferred to the
front, where the same undeclared statuses become a cast.

## Metrics

**Zero `kata-docs` lookups for this review.** Everything needed was answerable
locally: the `bodyLimit`/ADR-0011 reasoning from the PR's own code comment and
its sibling entry `c-json-has-no-headers-either-and-verify-lets-adhoc-errors-through.md`,
and `ErrorBodySchema.error: z.ZodString` (which is what makes
`c.error(outcome.code, ...)` legal for the four `@kumite/blocks` codegen codes)
read straight out of `context-CHM92emD.d.ts` in `node_modules` — one grep,
roughly the cost of a single MCP round-trip and with no ambiguity to resolve
afterwards.

That is a genuine data point about when kata-docs pays: for **behavioural**
questions ("does verify complain?", "which middleware wins?") an experiment
against a running server was faster and more convincing than any doc could be,
because it also proved the doc still matches 0.4.2. For **API-shape** questions
the `.d.ts` is the cheaper source. The docs earned their keep in #21's
*planning* (deciding the design) and earned nothing in its *review* — which is
probably the right split, not a deficiency.

Verification cost: ~3 minutes of wall clock (one `curl` triple against an
already-running server), no extra turns spent on dead ends. `kata verify
--strict-coverage` ran in well under the test suite's 22s and was never the
bottleneck.

## Suggested fix (optional)

Small and docs-only:

- A sentence in the `bodyLimit`/ADR-0011 material noting that `use` middleware
  short-circuits in array order, with the `[bodyLimit, requireAuth]` ordering as
  the worked example — it is the security-relevant ordering and it is currently
  left to inference.
- Where ADR-0011 says undeclared middleware statuses are fine on the server,
  a cross-reference to the RPC-client consequence (they are unreachable in the
  client's narrowed union) would let a route author make that trade knowingly
  instead of discovering it a task later.

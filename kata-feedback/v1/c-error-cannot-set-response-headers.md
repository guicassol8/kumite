# `c.error` has no way to set a response header — a 429 can't carry `Retry-After`

**Found while**: planning #21 (rota de submissão: codegen → sandbox → pontuação → veredito)
**Where in kata**: `@katajs-framework/core` — `c.error(code, message, extra?)`
(`guide/errors.md` § *Custom statuses*, ADR-0008 envelope, ADR-0011 multi-status
output schemas)

## What

Two findings from the same planning session — one gap, one "the docs were
right and saved me from a wrong guess".

**1. Gap (improvement idea, not a bug).** `c.error`'s documented signature is:

```ts
c.error(code: string, message: string, extra?: ErrorExtra): Response
type ErrorExtra = { status?: number; issues?: Record<string, FieldIssue[]> }
```

There is no slot for response headers. That is fine for the statuses the
envelope was designed around (400/404/409/422), but it breaks down for the
handful of 4xx statuses whose HTTP semantics *live in a header*:

- `429 Too Many Requests` → `Retry-After`
- `503 Service Unavailable` → `Retry-After`
- `405 Method Not Allowed` → `Allow`
- `401` with a scheme challenge → `WWW-Authenticate`

kumite's #21 needs exactly this: a per-identity 5s submission cooldown that
answers 429. The options a kata app is left with are all worse than they
should be:

- (a) `c.error('submission_throttled', 'Aguarde 5s…', { status: 429 })` and
  bury the remaining seconds in the human-readable `message` — which is what
  #21's plan chose. The client has to parse prose (or just guess) to build a
  countdown, and there's no `Retry-After` for any intermediary.
- (b) drop to `c.json(body, 429)` plus a manual `headers` — but then you own
  the envelope shape by hand and lose the ADR-0008 guarantee that every error
  on the wire looks the same. `ErrorBodySchema` in the route's `output` map
  still typechecks, so the drift is silent.
- (c) wrap the returned `Response` (`new Response(res.body, { …res, headers })`),
  which works but is boilerplate at every call site and easy to get subtly
  wrong (header casing, cloning a consumed body).

None of these are blocking — (a) ships — but a framework that owns the error
envelope arguably should own the headers that are part of that error's
protocol meaning.

**2. Positive: ADR-0011 answered the question I was about to get wrong.**
The plan puts `bodyLimit({ maxSize: 256 * 1024 })` and `requireUser` in the
route's `use:` chain, so the route can emit a `413` and a `401` that its
handler never produces. I was about to add both to the route's `output` map
"to be safe". ADR-0011 § *Validation semantics* says plainly that an
undeclared status produced by a middleware short-circuit is passed through
unvalidated, and § *Alternative C* explains why declaring them is actively
wrong (a short-circuit never reaches the handler, so there is nothing to
validate). That's one doc read that removed two incorrect lines from the plan.

Related: `reference/middleware.md`'s `bodyLimit` entry documents the 1 MiB
default and the `onError` hook, and states that kata's runtime calls
`c.req.json()` with **no** size guard — which is the fact that made "add
`bodyLimit` to this route" a decision rather than a guess. The `.hurl` payload
cap in #21's spec (256KB) has a real enforcement point because of it.

## Why it matters

For kumite: the judge is the one endpoint in the product designed to be
hammered (unlimited resubmission, "vale a melhor pontuação"), so its 429 is
the one error a client will programmatically react to. Losing `Retry-After`
means the front (#7) can only show a generic "aguarde" instead of a real
countdown, or kumite reintroduces the number as a non-standard field and
every consumer has to learn it.

For any kata consumer: rate limiting is common enough that the first app to
need it will hit this within an hour of starting, and will most likely pick
option (b) — hand-rolled `c.json` — quietly defeating the single-envelope
guarantee that ADR-0008 exists to provide.

## Metrics

- 5 `kata-docs` round-trips total this session: 2 `search_docs`
  (`bodyLimit request body size limit middleware`,
  `c.error status code 429 custom error code`), 1 `search_docs`
  (`middleware short-circuit response output schema validation declared statuses`),
  and 2 `read_doc` (`reference/middleware.md` § `bodyLimit`,
  `guide/errors.md` § *Custom statuses*). Roughly 3.5k tokens against a
  planning session of ~90k — well under 5%.
- Both `read_doc` calls changed the plan's text, not just confirmed it:
  `bodyLimit` turned "cap the payload somehow" into a concrete `use:` entry
  with the default and the 413 semantics named; the ADR-0011 hit deleted two
  `output` entries I had already drafted.
- Counterfactual on the gap: I would have discovered the missing header slot
  during implementation instead of planning, i.e. after writing the route —
  the search result snippets showed the full `ErrorExtra` type, so it cost
  one doc read to learn it at planning time rather than one failed edit later.
- Zero dead ends. Both searches put the right doc in the top hit.

## Suggested fix (optional)

Add `headers?: HeadersInit` to `ErrorExtra`:

```ts
type ErrorExtra = {
  status?: number
  issues?: Record<string, FieldIssue[]>
  headers?: HeadersInit
}

return c.error('rate_limited', 'Too many requests', {
  status: 429,
  headers: { 'Retry-After': '5' },
})
```

Purely additive, no behavior change for existing call sites, and it keeps the
ADR-0008 envelope as the path of least resistance for the statuses where it
currently isn't. If that feels too open-ended, a narrower version — kata
setting `Retry-After` itself when a documented `retryAfter?: number` is passed
alongside a 429/503 — would cover the common case without letting apps set
arbitrary headers through the error path.

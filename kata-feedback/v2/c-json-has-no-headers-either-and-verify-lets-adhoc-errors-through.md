# `c.json` has no headers argument either — and `no-adhoc-error-shape` lets the workaround through

**Found while**: implementing #21 (rota de submissão: codegen → sandbox →
pontuação → veredito)
**Where in kata**: `@katajs-framework/core` 0.4.2 — `c.json` / `c.error`
(`context-*.d.ts`), rule `kata/no-adhoc-error-shape` (ADR-0008), `bodyLimit`
(ADR-0011)

Implementation-side follow-up to `c-error-cannot-set-response-headers.md`,
written during the planning of the same issue. Two of that entry's claims
turned out to be worth correcting, and one turned out to be exactly right.

## What

**1. The gap is one step wider than planning thought.** The planning entry
listed "drop to `c.json(body, 429)` plus a manual `headers`" as the escape
hatch for `Retry-After`. That option does not exist. kata's context types it
as:

```ts
json<T>(value: T, status?: number): Response
```

Two parameters, no `headers` — unlike Hono's own `c.json(body, status, headers)`
that it wraps. Passing a third argument is a compile error:

```
src/modules/submissions/submissions.route.ts(54,11):
  error TS2554: Expected 1-2 arguments, but got 3.
```

So in 0.4.2 a handler has **no** helper that can attach a response header at
all: not `c.error` (no slot in `ErrorExtra`), not `c.json`. The only way out
is building the `Response` by hand — which does typecheck, because the handler
return type accepts a raw `Response`:

```ts
return new Response(JSON.stringify({ error: 'submission_throttled', message }), {
  status: 429,
  headers: { 'Content-Type': 'application/json', 'Retry-After': '4' },
})
```

**2. `kata/no-adhoc-error-shape` does not catch either workaround.** Both the
hand-rolled `c.json({ error, message }, 429)` and the raw `new Response(...)`
above passed `kata verify --strict-coverage` clean (38 files, 0 problems).
The planning entry guessed the drift would be silent; it is, and the rule
whose name promises otherwise is the reason that is surprising. I did not
chase down what the rule *does* match — the finding is only that these two
shapes reach a route unflagged.

kumite took neither path: #21 ships `c.error('submission_throttled', 'Wait 4s
before submitting again', { status: 429 })`, envelope intact, no header, the
seconds in the message (decision confirmed with the user during
implementation).

**3. ADR-0011 held up in production, not just on paper.** The planning entry
removed `413` and `401` from the route's `output` map on the strength of
ADR-0011. Verified live against the running API: a 300KB body to
`POST /submissions` answers `413` with the standard envelope, and does it
*before* auth (no token was sent and the answer was still 413, so `bodyLimit`
short-circuits ahead of `requireUser` in the `use:` chain). Neither status is
declared, and nothing complains at runtime or in `verify`.

## Why it matters

For kumite: nothing is blocked — the 429 ships without `Retry-After` by
choice. But the workaround the planning entry expected to be available is
not, so the cost of kata gaining a header slot is lower than it looked: there
is no "apps can already do it the ugly way with `c.json`" fallback to weigh
against it.

For any kata consumer: an app that needs `Retry-After`, `Allow` or
`WWW-Authenticate` today must hand-build a `Response`, and the moment it does,
it is outside the ADR-0008 envelope with no lint telling it so. That is the
combination that turns a small ergonomic gap into silent divergence across a
codebase.

## Metrics

- **Zero** `kata-docs` MCP round-trips during implementation, against ~40
  tool calls for the task. The one API-shape question that came up
  (`bodyLimit`'s options) was answered by `sed`-ing 40 lines out of the
  shipped `back/node_modules/@katajs-framework/core/dist/index.d.ts` — faster
  than an MCP round-trip and authoritative for the installed version, which
  is what matters when the question is "what is the signature here".
- The planning session's 5 round-trips (~3.5k tokens) carried over verbatim:
  the `use:` chain, the omitted `413`/`401`, and the 429 decision were all
  written straight from the plan with no re-lookup. Doc cost paid once,
  consumed twice — that is the shape that pays for itself.
- The three facts corrected/confirmed above came from ~4 local probes
  (edit → `typecheck` → `verify` → restore), roughly 2 minutes. Reading the
  installed `.d.ts` would have caught #1 alone; only running `verify` against
  a deliberately wrong route caught #2.
- `kata verify` ran on all 7 commits via the pre-commit hook: 0.59–0.61s
  every time, never blocked, never a false positive. It is ~4s of the ~5min
  the full hook ladder cost across this task; the rest is vitest.
- `kata verify --help` lists all 13 rules with their ADR numbers — that is how
  I found `no-adhoc-error-shape` to probe it in the first place. Worth keeping.

## Suggested fix (optional)

Nothing new beyond the planning entry's proposal (add `headers?: HeadersInit`
to `ErrorExtra`). Two smaller notes:

- If `c.json` is meant to stay a two-argument helper, saying so in the docs
  next to the Hono comparison would save the next app the compile error —
  right now the natural assumption is that it forwards Hono's third argument.
- If `kata/no-adhoc-error-shape` is meant to catch a hand-built error
  `Response` in a route handler, it currently does not; if it is not, the name
  invites the assumption that it does.

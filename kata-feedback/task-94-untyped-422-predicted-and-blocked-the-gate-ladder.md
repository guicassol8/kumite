# The untyped 422 envelope finally blocked the gate ladder — exactly the TS2367 `task-49` predicted

**Found while**: #94 (validate every input id as a uuid across the back, plus
treating the resulting 422 as not-found on the four front screens with an id in
the URL)
**Where in kata**: `@katajs-framework/core` — the automatic `422
validation_failed` envelope, and its absence from a route's declared `output`
(and therefore from `hc<AppType>`'s inferred status union).

## What

This is a reoccurrence report, not a new finding:
`task-49-front-only-422-envelope-untyped-in-hc-client.md` already described this
gap and wrote, verbatim, that it is "easy to trip into a real `TS2367` ('no
overlap') if you instead compare `res.status === 422` directly — which is what
the natural-looking code would do."

That is precisely what happened. #94's job on the front was one line per
fetcher:

```ts
if (res.status === 404 || res.status === 422) throw new ProblemNotFoundError()
```

`pnpm -r typecheck` rejected all four:

```
src/lib/problems-query.ts(14,29): error TS2367: This comparison appears to be
  unintentional because the types '200' and '422' have no overlap.
src/lib/rounds-query.ts(20,29): error TS2367: ...
src/routes/organizer.problems.$id.edit.tsx(29,29): error TS2367: ...
src/routes/organizer.rounds.$id.edit.tsx(22,29): error TS2367: ...
```

Two things are new relative to task-49:

1. **It hit a read route, not a mutation.** task-49 framed the gap as a
   mutation problem ("every kumite mutation route that has *any* validated
   input"). But a route whose only input is `params: { id: UuidSchema }` is a
   plain `GET`, and its `output` is `{ 200: X, 404: ErrorBodySchema }` — the
   422 is just as invisible there, and the *whole point* of #94 is that a
   malformed URL id is now a 422 the front must react to. So the gap isn't
   about bodies; it's about any route with a validated input, which after this
   task is every route that takes an id.
2. **It blocked the ladder rather than being silently dropped.** task-49 could
   work around it by branching on `else` and reading the body through
   `unknown`. Here the front genuinely needs to *name* the status — "422 means
   this link points at nothing" — so there is no `else` branch to hide in. The
   pre-commit hook failed on typecheck twice before the shape was settled.

The user chose the explicit-cast workaround over the alternative of declaring
`422: ErrorBodySchema` on the back routes' `output`, on the grounds that this
codebase deliberately keeps framework-level responses (401/403/413) out of
`output` per kata ADR-0011 — so declaring 422 there alone would be
inconsistent. What landed, in four places:

```ts
// The cast is the point: 422 is kata's input-validation envelope, which no
// route declares in `output` (same rule that keeps 401/403/413 out of it),
// so the RPC client's status union genuinely doesn't know about it.
if (res.status === 404 || (res.status as number) === 422) throw new ProblemNotFoundError()
```

A cast in four hot paths, each needing a three-line comment to explain why a
comparison against a status the server really returns is a type error, is the
tax this gap charges.

## Why it matters

task-49's suggested fix (a) — auto-augment every route's client-facing status
union with the 422 (and malformed-JSON 400) the framework can always produce —
would have made #94's front work exactly the one line it looks like, with no
cast and no comment. The gap has now cost two tasks; the second one had the
first one's report on file and still had to rediscover the workaround shape,
because the recommended pattern lives in this folder rather than in kata's
docs. That is an argument for fix (b) at minimum: whatever kata's answer is,
it should be reachable from kata-docs, not from a sibling project's feedback
directory.

Worth noting the other half of the trade too: the fix `.uuid()` buys is real.
The five requests #94 confirmed as `500 internal_error` in production
(`GET /rounds/:id`, `/rounds/:id/ranking`, `/organizer/problems/:id`,
`POST /teams/:id/join`) all answer `422 validation_failed` now, from schema
changes alone. kata's input layer did its job; only its *type* surface lagged.

## Metrics

- **kata-docs MCP round-trips: zero.** Nothing in this task needed a framework
  API I didn't already have in front of me — `defineRoute`/`output` shapes were
  readable from the ~15 route files being touched, and the 422 envelope's exact
  form (`{error, message, issues: {params|body|query}}`) came from an existing
  `problems.hurl` assertion (step 10g) plus one observed response. Guessing
  from neighbouring code beat a lookup here, and I'd make the same call again
  for a task that only edits schemas.
- **`kata verify`: clean on every one of the 5 commits**, no findings, ~0.7–1.3s
  each. It has nothing to say about this class of change (schema refinements
  inside an already-valid module layout) — no false positives, but no signal
  either.
- **Where the time actually went: the hurl database ritual, again.** The suite
  failed 2/14 files on the first run with assertions that looked like my bug
  (`maxTeamSize` expected 3, got 6) and were pure leftover state from a
  previous partial run. A truncate-everything + `db:seed` reset made it 14/14,
  276 requests, twice in a row. That's the fourth or fifth entry in this folder
  reporting the same tax (`hurl-and-unit-tests-fight-over-one-database.md`,
  `task-53-...-reset-tax.md`, `review-141-...-volume-wipe.md`). The suite is
  not idempotent and nothing in `pnpm hurl` says so — a `--reset-db` flag, or
  even a documented "run this first" snippet in kata's hurl guide, would turn a
  confusing 10-minute detour into a flag.
- Gate-ladder cost: the pre-commit hook runs all three packages' suites
  (~80–100s per commit) on every commit including back-only ones — 5 commits,
  so ~7 minutes of ladder for a task whose own tests run in 6s.

## Suggested fix (optional)

Nothing new beyond task-49's (a)/(b) — this entry exists to say the predicted
failure mode arrived, on a route class task-49 didn't anticipate (reads), and
that it now blocks rather than merely misleads. If (a) is off the table, the
minimum that would have helped: a kata-docs page named something like
"statuses your handler doesn't declare" listing 401/403/413/422/400, why they
are absent from `output`, and the sanctioned client-side pattern for naming one.

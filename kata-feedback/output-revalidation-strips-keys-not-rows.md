# Output re-validation strips unknown *keys*, but cannot drop unwanted *rows* — a defence-in-depth expectation kata can't meet

**Found while**: reviewing-tasks for PR #95 / issue #11 (participant problem
read — "hidden test cases must never reach a participant")
**Where in kata**: `defineRoute`'s `output` schema re-validation; the
`reference/define-route.md` § `output` docs

## What

PR #95 states it has "two barriers" against leaking hidden test cases:

1. the service filters `testCases` with `.filter(tc => !tc.hidden)`;
2. kata re-validates the handler's return value against an output schema
   (`ExampleCaseSchema = { input, expected }`) that deliberately does not
   declare `hidden`, so zod strips it.

I tested barrier 2 in isolation: with the service patched to
`problem.testCases.map(tc => ({ ...tc }))` — no filter, raw spread — and the
route otherwise untouched, the response was

```json
{"examples":[{"input":1,"expected":"VISIVEL"},{"input":2,"expected":"VAZOU-SEGREDO"}]}
```

So the re-validation **did** strip the `hidden` key (zod strip works exactly
as advertised), but the hidden case's `expected` value shipped to the client
in full — because `input` and `expected` are legitimately declared fields, and
nothing in an output schema can say "this *element* should not be in the
array at all".

That is correct, expected zod/kata behaviour. The gap is in what a reader
reasonably infers from it: an output schema that omits a sensitive **flag**
reads like it also suppresses the **records** carrying that flag, and it does
not. The shipped code is safe — the filter is barrier 1 and it is the only
one that matters here — but the review comment and the test comment in the PR
both described barrier 2 as "a second line of defence against leaking hidden
cases", which overstates it by one important step.

## Why it matters

This is the shape of a future regression, not a present bug. A maintainer who
believes the output schema is a safety net has a reason to relax the service
filter ("the schema won't let it through anyway"), and the resulting leak is
silent: status 200, schema-valid, no `kata verify` complaint, no failing type.
Row-level authorization is genuinely outside what a per-response schema can
express — worth saying so out loud in the docs, precisely because the
key-stripping behaviour is strong enough to invite the wrong generalization.

Second, smaller observation from the same review: `kata verify --strict-coverage`
was clean (38 files) on a diff that adds a route whose sibling routes in the
same file answer `500 internal_error` to a malformed path param
(`GET /organizer/problems/nao-e-uuid`, reproduced live during this review;
kumite issue #94). Verify knows the route and the schema but not that `:id`
lands in a `uuid` column, so the latent 500 is invisible to it. That is a
reasonable limit, and it lines up with observation (2) in
`first-query-param-route-and-a-hurl-count-trap.md`, recorded there from the
implementation side and confirmed here against a running server.

## Metrics

- kata-docs lookups this review: **0**. The diff was small and idiomatic, and
  the two kata behaviours I actually needed to know (input-validation envelope
  shape, output re-validation semantics) were faster to establish empirically
  — one sabotage-and-probe cycle against a live server — than to look up.
  Deciding whether that was the right call: for the output-schema question it
  clearly was, since the answer I needed ("does it drop rows?") is a negative
  that docs rarely state explicitly.
- Cost of the empirical check: 1 extra server boot on a second port (~15s) and
  3 turns. Cheap, and it converted an unverified claim in the PR body into a
  measured one.
- `kata verify --strict-coverage`: clean, ~0.6s, 38 files, no false positives
  on a route using `use: [requireUser]` plus both `params` and `query` input
  schemas.
- `pnpm --filter @kumite/back hurl`: 7 files / 76 requests green in 2.1s
  against a throwaway Postgres — no kata friction.

## Suggested fix (optional)

One sentence in `reference/define-route.md` § `output`: the response schema
strips undeclared keys but cannot filter elements out of an array — any
"these rows are not for this audience" rule has to live in the handler or the
service, and the schema is not a backstop for it.

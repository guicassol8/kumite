# Array route outputs aren't documented, but "just work" once named

**Found while**: #10 (organizer problems CRUD — `GET /organizer/problems` returns a list)
**Where in kata**: route `output` declarations / `kata verify`'s `kata/inline-schema` rule

## What

I needed a route whose `output` is a list (`ProblemSummary[]`), not a single
object. `mcp__kata-docs__search_docs` for "array output response body list"
returned nothing that confirms `output: z.array(FooSchema)` is a normal,
supported single-entry output (equivalent to `{ 200: z.array(FooSchema) }`).
The only tangentially relevant hit was `guide/routes-schemas.md`'s
"Validating a `Response`" section, which mentions the single-entry-means-200
rule in passing but not in the context of arrays specifically.

I ended up just trying `output: z.array(ProblemSummarySchema)` on the
assumption that `output` accepts any `z.ZodTypeAny` — it worked, and
`kata verify --strict-coverage` immediately (and correctly) flagged the
inline `z.array(...)` call in the route file as a `kata/inline-schema`
violation (ADR-0005: schemas must live in `<domain>.schema.ts`), with a
clear fix. Moving it to a named `ProblemSummaryListSchema` export in
`problems.schema.ts` resolved it.

## Why it matters

The mechanism itself (any Zod schema, including `z.array(...)`, is valid as
`output`) is unsurprising once you know it, but nothing in the indexed docs
states it explicitly for the array case, so an agent has to either guess or
grep kata's own source. The `kata/inline-schema` lint rule did the real
work here — it caught the mistake and taught the fix in one shot, which is
worth calling out as a positive: no separate kata-docs lookup was needed to
resolve it once `kata verify` fired.

## Metrics

- 2 `search_docs` calls this task (array-output question, drizzle upsert
  question). Both returned low-relevance hits; neither meaningfully sped up
  or would have prevented the ~1 iteration it took to get the array output
  right (trial + `kata verify`'s own error message did that instead).
- Net kata-docs cost: small (2 short searches, no `read_doc` calls) against
  a multi-hour task — didn't pay for itself here, but the cost was low
  enough not to matter. `kata verify --strict-coverage`'s inline error
  message was the higher-value signal of the two.

## Suggested fix

Add one sentence + example to `guide/routes-schemas.md` under output
declarations: "`output` accepts any named Zod schema, including
`z.array(...)` for list endpoints — declare it in `<domain>.schema.ts` like
any other output schema."
